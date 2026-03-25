# BESS ERCOT Revenue Forecasting Model

A React/TypeScript Monte Carlo simulation tool for forecasting Battery Energy Storage System (BESS) revenues in the ERCOT market. The model uses a duration-dependent two-regime Markov chain (normal / high) with log-normal revenue draws, revenue momentum autocorrelation, and a live preview panel — all configurable through a browser-based UI with scenario persistence via IndexedDB.

## Table of Contents

1. [Recent Enhancements](#recent-enhancements)
2. [Model Specification](#model-specification)
3. [Input Schema](#input-schema)
4. [Project Structure](#project-structure)
5. [Testing Strategy](#testing-strategy)
6. [Validation Rules](#validation-rules)
7. [Getting Started](#getting-started)

---

## Recent Enhancements

The following five features were added in the most recent development cycle:

### 1. Duration-Dependent Transition Probabilities

The `TransitionMatrix` type now stores arrays of 10 probabilities rather than single scalars. Each index `i` represents the probability of transitioning when the system has been in the current regime for `(i+1)` consecutive days; index 9 applies to all days beyond day 10. This allows the model to capture regime persistence — for example, a high-revenue period that becomes progressively harder to exit as it ages.

The UI renders a compact 10-cell grid per direction per season, with an SVG sparkline preview and preset shape buttons (flat, decreasing, increasing). The helper `flatProbs(p)` fills all 10 slots with a single value for simple cases.

### 2. Separate Copy Controls

`YearTabPanel` now offers granular copy operations so users can independently propagate distributions or transition matrices without overwriting the other. Three copy modes are available: Distributions only, Transitions only, and Both — each with a choice of "All years" or "Y{n}+ remaining years".

### 3. Live Preview Panel

A collapsible panel debounces 600 ms after any input change and runs a 200-trial mini-simulation synchronously on the main thread. It renders three fan charts side-by-side: Combined Revenue (total annual), Normal-Day Revenue, and High-Day Revenue. Because only 200 trials are used, this completes fast enough to feel interactive without blocking the UI.

### 4. Path-Dependent Momentum (Revenue-Anchored Annual Accumulation)

Each trial accumulates a **non-reverting drift** driven by its own realized revenues. At the end of every year, the trial's annual log-revenue per day is compared to the year's stationary baseline; the deviation is scaled by `pathWeight` and added permanently to a cumulative drift applied to all future years:

```
deviation[y]     = log(annualRevenue[y] / 365) − baselineLogMean[y]
cumulativeDrift += pathWeight × deviation[y]
adjustedMu[y+1]  = baseMu[regime] + cumulativeDrift
```

- Trials that run above baseline accumulate a permanent upward mu shift — they stay high
- Trials that run below baseline drift down symmetrically — they stay low
- No mean reversion at any time horizon
- Effect is symmetric in log-space; both tails widen proportionally
- When disabled, zero extra computation — bit-exact backward compatibility

Config: `momentum: { enabled: boolean; pathWeight: number }` — `pathWeight` in `[0, 1]`. `0.10–0.25` is the recommended range. Use the Live Preview fan chart to calibrate visually.

### 5. Excel Import/Export Template

A new Excel workflow lets underwriters manage all simulation inputs in a spreadsheet:
- **Export**: Click "Export to Excel" to download a `.xlsx` file pre-populated with the current configuration
- **Import**: Fill in the spreadsheet and click "Import from Excel" to load all inputs instantly
- Template has 6 sheets: Instructions, Settings, Seasons, Distributions, Summer_Transitions, Other_Transitions
- Seasons sheet: 12 months → "summer" | "other" assignment
- Distributions sheet: μ and σ for normal and high regimes across all 10 years
- Transition sheets: 10 duration-dependent probabilities (D1–D10) for N→H and H→N per year per season
- Full validation with descriptive error messages on import failure

### 6. Simulation Naming with Notes

`SavedConfig` now includes an optional `description` field. The Save modal exposes a Notes/Description textarea, and the saved scenario list renders the description beneath the scenario name.

---

## Model Specification

### Two-Regime Markov Chain

Each simulated day is assigned one of two regimes — **normal** or **high** — according to a first-order (duration-dependent) Markov process. The daily regime drives which log-normal distribution is sampled for that day's revenue.

### Markov Chain Transition Matrix (Duration-Dependent)

Rather than a single transition probability, each season carries two arrays of 10 probabilities:

| Array | Meaning |
|---|---|
| `pNormalToHigh[i]` | P(transition to high \| been in normal for `i+1` consecutive days) |
| `pHighToNormal[i]` | P(transition to normal \| been in high for `i+1` consecutive days) |

Index `i = 9` is the cap: it applies to day 10 and all subsequent days in that regime. All values must be strictly in `(0, 1)`.

**Example:** setting `pNormalToHigh` to `[0.03, 0.04, 0.05, 0.06, 0.07, 0.07, 0.07, 0.07, 0.07, 0.07]` means a system that has been normal for just one day has a 3% daily escape probability, rising to 7% after five or more days.

For simple flat-probability cases, use the `flatProbs(p)` helper which fills all 10 slots with the same value.

### Revenue Distributions

Within each regime, daily revenue is drawn from a log-normal distribution parameterised in log space:

| Parameter | Meaning |
|---|---|
| `mu` | Log-space mean (any real number) |
| `sigma` | Log-space standard deviation (> 0) |

Separate distribution parameters are specified per year (10 years total) and per regime (normal / high). A warning is emitted if the implied arithmetic mean for high days does not exceed that for normal days.

### Path-Dependent Momentum

The **momentum** feature creates non-reverting path divergence anchored to each trial's own realized revenues. Each trial maintains a `cumulativeDrift` (log-space mu offset). At the end of every year the drift is updated:

```
baselineLogMean  = piN × normal.mu + piH × high.mu     (stationary-weighted)
deviation[y]     = log(annualRevenue[y] / 365) − baselineLogMean
cumulativeDrift += pathWeight × deviation[y]

adjustedMu[y+1]  = baseMu[regime] + cumulativeDrift
```

Trials that realize above-baseline revenues accumulate a permanent positive drift; below-baseline trials drift down. Because the update is additive and unbounded, there is no mean reversion at any time horizon — the fan widens monotonically. The effect is symmetric in log-space: a +Δ drift and a −Δ drift produce equal percentage changes in either direction (in dollar terms the right tail widens slightly more due to the log-normal shape, which is unavoidable).

**Key property**: When `enabled = false`, `cumulativeDrift` stays at zero and no extra computation occurs, preserving bit-exact reproducibility of pre-feature results.

### Season Definition

Each of the 12 calendar months is independently mapped to either `"summer"` or `"other"`. Transition matrices and (optionally) revenue distributions can differ between seasons. At least one month must belong to each season.

---

## Input Schema

### Full Configuration Object

```typescript
interface SimulationConfig {
  id?: string;
  name?: string;
  baseSeed: number;        // Integer in [0, 2^32 − 1]
  numTrials: number;       // Integer in [100, 10000]
  startYear: number;       // Integer in [2020, 2060]
  seasonDefinition: SeasonDefinition; // Record<1..12, 'summer' | 'other'>
  years: YearParams[];     // Exactly 10 entries
  momentum: MomentumConfig;
}

interface YearParams {
  year: number;            // 1–10
  normal: LogNormalParams;
  high: LogNormalParams;
  summer: TransitionMatrix;
  other: TransitionMatrix;
}

interface LogNormalParams {
  mu: number;    // Log-space mean
  sigma: number; // Log-space std dev (> 0)
}

/** Duration-dependent transition matrix. Each array has exactly 10 elements. */
interface TransitionMatrix {
  pNormalToHigh: number[]; // length 10; index i = prob when in normal for i+1 consecutive days
  pHighToNormal: number[]; // length 10; index i = prob when in high for i+1 consecutive days
}

interface MomentumConfig {
  enabled: boolean;
  /**
   * Drift accumulation scale. Range [0, 1].
   * Each year's log-revenue deviation from the stationary baseline is multiplied
   * by this factor and added permanently to future years' mu.
   * 0.10–0.25 is recommended. Higher values produce faster fan widening.
   */
  pathWeight: number;
}

interface SavedConfig {
  id: string;
  name: string;
  description?: string;   // Optional notes / scenario assumptions
  createdAt: string;
  updatedAt: string;
  config: SimulationConfig;
}

/** Helper — creates an array of 10 identical probability values */
function flatProbs(p: number): number[];
```

---

## Project Structure

```
src/
  App.tsx                              # Root layout; tab routing
  main.tsx                             # React entry point
  index.css                            # Tailwind base styles

  core/
    types.ts                           # All domain types and constants
    distributions.ts                   # Log-normal sampling and real-space conversion
    markov.ts                          # Duration-dependent Markov chain logic
    simulator.ts                       # Main Monte Carlo engine (runs in worker)
    statistics.ts                      # Percentile / histogram computation
    validation.ts                      # Config validation (returns ValidationIssue[])
    migration.ts                       # Schema migration for persisted configs
    excelTemplate.ts                   # Excel template generation and parsing (xlsx library)

  components/
    inputs/
      YearTabPanel.tsx                 # Per-year input tabs with granular copy controls
      MarkovInputs.tsx                 # 10-cell transition probability grids + sparklines
      DistributionInputs.tsx           # Normal/high log-normal parameter inputs
      MomentumInput.tsx                # MomentumConfig UI (drift scale slider + enable toggle)
      SeasonDefinitionInput.tsx        # Month→season assignment grid
      SimSettings.tsx                  # Global settings (trials, seed, start year)

    outputs/
      FanChart.tsx                     # Reusable fan chart (P10/P25/P50/P75/P90)
      LivePreviewPanel.tsx             # Collapsible 200-trial mini-simulation fan charts
      AnnualSummaryTable.tsx           # Annual percentile summary table
      HistogramPanel.tsx               # Per-year revenue histogram
      RegimeBreakdown.tsx              # Normal vs high regime revenue split

    saved/
      ConfigList.tsx                   # Saved scenario browser with description display
      SaveConfigModal.tsx              # Save modal with name + notes textarea
      ComparePanel.tsx                 # Side-by-side scenario comparison

    shared/
      ErrorBoundary.tsx
      ExcelImportExport.tsx            # Download template / upload filled template UI
      LoadingSpinner.tsx
      TooltipHelp.tsx
      ValidationMessage.tsx

  hooks/
    useSimulation.ts                   # Manages worker lifecycle and result state
    useConfigs.ts                      # CRUD operations for SavedConfig via IndexedDB
    useValidation.ts                   # Debounced config validation
    useLivePreview.ts                  # 200-trial debounced preview simulation hook

  store/
    configStore.ts                     # Zustand store for active SimulationConfig
    resultStore.ts                     # Zustand store for SimulationResult
    db.ts                              # Dexie (IndexedDB) schema and instance

  workers/
    simulation.worker.ts               # Vite web worker; runs full simulation off main thread

tests/
  unit/
    distributions.test.ts
    markov.test.ts
    rng.test.ts
    simulator.test.ts
    statistics.test.ts
    validation.test.ts
  integration/
    simulationPipeline.test.ts
    configStore.test.ts
  fixtures/
    validInputs.ts
    expectedOutputs.ts
  setup.ts
```

---

## Testing Strategy

Tests are colocated in `tests/` and separated into unit and integration tiers.

**Unit tests** (`tests/unit/`) cover individual core modules in isolation:
- `rng.test.ts` — determinism and distribution of the seeded RNG
- `distributions.test.ts` — log-normal sampling accuracy and real-space conversion
- `markov.test.ts` — duration-dependent transition logic and regime sequence properties
- `statistics.test.ts` — percentile and histogram correctness
- `simulator.test.ts` — per-trial revenue accumulation and momentum adjustment
- `validation.test.ts` — error and warning coverage for all validation rules

**Integration tests** (`tests/integration/`) exercise assembled pipelines:
- `simulationPipeline.test.ts` — end-to-end simulation with snapshot assertions on percentile outputs
- `configStore.test.ts` — IndexedDB save/load/delete round-trips

Snapshot files are stored alongside test files in `__snapshots__/` and committed to version control. Run tests with:

```bash
npm test
```

---

## Validation Rules

All fields are validated by `src/core/validation.ts`. Errors block simulation; warnings are advisory.

| Field | Severity | Rule |
|---|---|---|
| `baseSeed` | Error | Integer in `[0, 4294967295]` |
| `numTrials` | Error | Integer in `[100, 10000]` |
| `startYear` | Error | Integer in `[2020, 2060]` |
| `seasonDefinition[m]` | Error | Each month must be `"summer"` or `"other"` |
| `seasonDefinition` | Error | At least one month must be `"summer"` |
| `seasonDefinition` | Error | At least one month must be `"other"` |
| `years` | Error | Must have exactly 10 entries |
| `years[i].year` | Error | Must equal `i + 1` |
| `years[i].{normal,high}.mu` | Error | Must be a finite number |
| `years[i].{normal,high}.sigma` | Error | Must be a positive finite number |
| `years[i].{summer,other}.pNormalToHigh` | Error | Must be an array of exactly 10 values, each strictly in `(0, 1)` |
| `years[i].{summer,other}.pHighToNormal` | Error | Must be an array of exactly 10 values, each strictly in `(0, 1)` |
| `years[i]` | Warning | High-day implied arithmetic mean should exceed normal-day mean |
| `momentum.pathWeight` | Error | Must be finite and in `[0, 1]` (validated regardless of `enabled`) |

---

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run production build
npm run build

# Run tests
npm test
```

The application runs entirely in the browser. Saved scenarios are stored in the browser's IndexedDB and persist across sessions. Heavy simulations (> 200 trials) run in a dedicated web worker to keep the UI responsive.
