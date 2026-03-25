// ============================================================
// Core Domain Types for BESS ERCOT Revenue Forecasting Model
// ============================================================

export type Regime = 'normal' | 'high';
export type Season = 'summer' | 'other';
export type Severity = 'error' | 'warning';

export const TRANSITION_DURATION_STEPS = 10 as const;

/** Maps each calendar month (1=Jan...12=Dec) to a season. All 12 must be present. */
export type SeasonDefinition = Record<number, Season>;

export interface LogNormalParams {
  mu: number;    // Log-space mean (any real number)
  sigma: number; // Log-space std dev (> 0)
}

export interface RealSpaceParams {
  mean: number;  // Arithmetic mean ($/day)
  std: number;   // Arithmetic std dev ($/day)
}

/**
 * Duration-dependent Markov transition matrix.
 * Each array has exactly TRANSITION_DURATION_STEPS elements.
 * Index i represents the probability when the system has been
 * in the current regime for (i+1) consecutive days.
 * Index 9 (day 10) applies to all subsequent days (10+).
 */
export interface TransitionMatrix {
  /** pNormalToHigh[i] = P(→high | normal for i+1 consecutive days). Each in (0,1). */
  pNormalToHigh: number[];
  /** pHighToNormal[i] = P(→normal | high for i+1 consecutive days). Each in (0,1). */
  pHighToNormal: number[];
}

export interface YearParams {
  year: number;           // 1-10
  normal: LogNormalParams;
  high: LogNormalParams;
  summer: TransitionMatrix;
  other: TransitionMatrix;
}

/**
 * Path-Dependent Revenue Momentum (non-reverting annual accumulation).
 *
 * At the end of each year, the trial's realized annual log-revenue per day is
 * compared to the year's stationary baseline log-mean. The deviation is scaled
 * by pathWeight and added PERMANENTLY to a cumulative drift applied to all
 * future years' mu:
 *
 *   deviation[y]    = log(annualRevenue[y] / 365) − baselineLogMean[y]
 *   cumulativeDrift += pathWeight × deviation[y]
 *   adjustedMu[y+1] = baseMu[regime] + cumulativeDrift
 *
 * Because the drift is cumulative (not EMA-based), there is NO mean reversion —
 * a trial that runs high in early years accumulates a permanent upward shift that
 * compounds into later years. Low trials drift down symmetrically.
 *
 * In log-space the effect is symmetric: a +Δ shift is exactly mirrored by a −Δ
 * shift, so both tails widen proportionally. In dollar space the right tail
 * expands faster (log-normal right skew), but this is an unavoidable property
 * of log-normal distributions.
 */
export interface MomentumConfig {
  enabled: boolean;
  /** Drift accumulation scale [0, 1].
   *  Each year's log-revenue deviation from baseline is multiplied by this
   *  and added permanently to future years' mu shift.
   *  0.10–0.25 is recommended; >0.40 creates very strong long-run divergence. */
  pathWeight: number;
}

export interface SimulationConfig {
  id?: string;
  name?: string;
  baseSeed: number;
  numTrials: number;
  startYear: number;
  seasonDefinition: SeasonDefinition;
  years: YearParams[];
  momentum: MomentumConfig;
}

export interface DayRecord {
  trial: number;
  year: number;
  day: number;
  regime: Regime;
  revenue: number;
}

export interface DescriptiveStats {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; std: number; min: number; max: number;
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  count: number;
  frequency: number;
}

export interface RegimeAnnualStats {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number;
}

export interface AnnualResult {
  year: number;
  calendarYear: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  meanHighFraction: number;
  histogramBins: HistogramBin[];
  normalStats: RegimeAnnualStats;
  highStats: RegimeAnnualStats;
}

export interface TrialData {
  trial: number;
  annualRevenues: number[];
  annualHighDayFractions: number[];
  annualNormalRevenues: number[];
  annualHighRevenues: number[];
}

export interface SimulationResult {
  configHash: string;
  runTimestamp: string;
  annualResults: AnnualResult[];
  trialData: TrialData[];
}

export interface ValidationIssue {
  field: string;
  severity: Severity;
  message: string;
}

export interface SavedConfig {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  config: SimulationConfig;
}

export interface SavedResult {
  id: string;
  configId: string;
  configSnapshot: SimulationConfig;
  configHash: string;
  result: SimulationResult;
  createdAt: string;
}

export interface SimulationProgress {
  completedTrials: number;
  totalTrials: number;
  status: 'idle' | 'running' | 'complete' | 'error';
  error?: string;
}

/** Helper: create a flat array of 10 identical probability values */
export function flatProbs(p: number): number[] {
  return Array(TRANSITION_DURATION_STEPS).fill(p) as number[];
}

export const DEFAULT_SEASON_DEFINITION: SeasonDefinition = {
  1: 'other', 2: 'other', 3: 'other', 4: 'other', 5: 'other',
  6: 'summer', 7: 'summer', 8: 'summer',
  9: 'other', 10: 'other', 11: 'other', 12: 'other',
};

export const DEFAULT_MOMENTUM: MomentumConfig = {
  enabled: false,
  pathWeight: 0.20,
};

export function createDefaultYearParams(year: number): YearParams {
  return {
    year,
    normal: { mu: 10.5, sigma: 0.4 },
    high: { mu: 12.0, sigma: 0.6 },
    summer: { pNormalToHigh: flatProbs(0.05), pHighToNormal: flatProbs(0.3) },
    other:  { pNormalToHigh: flatProbs(0.02), pHighToNormal: flatProbs(0.4) },
  };
}

export function createDefaultConfig(): SimulationConfig {
  return {
    baseSeed: 42,
    numTrials: 1000,
    startYear: 2025,
    seasonDefinition: { ...DEFAULT_SEASON_DEFINITION },
    years: Array.from({ length: 10 }, (_, i) => createDefaultYearParams(i + 1)),
    momentum: { ...DEFAULT_MOMENTUM },
  };
}
