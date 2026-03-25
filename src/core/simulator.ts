import { SimulationConfig, SimulationResult, TrialData, AnnualResult, RegimeAnnualStats } from './types';
import { SeededRNG } from './rng';
import { sampleLogNormal } from './distributions';
import { sampleNextRegime, sampleInitialRegime, getSeasonForDay, stationaryDistribution } from './markov';
import { describeDistribution, buildHistogram } from './statistics';


/** Generate a deterministic SHA-256 hash of the simulation config */
export async function hashConfig(config: SimulationConfig): Promise<string> {
  const { id: _id, name: _name, ...hashable } = config;
  void _id; void _name;
  const canonical = JSON.stringify(hashable, Object.keys(hashable as Record<string, unknown>).sort());
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function computeRegimeStats(values: number[]): RegimeAnnualStats {
  if (values.length === 0) return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, mean: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const perc = (p: number): number => {
    const idx = p * (n - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const frac = idx - lo;
    return sorted[lo]! + frac * ((sorted[hi] ?? sorted[lo]!) - sorted[lo]!);
  };
  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  return { p10: perc(0.1), p25: perc(0.25), p50: perc(0.5), p75: perc(0.75), p90: perc(0.9), mean };
}

interface TrialResult {
  annualRevenues: number[];
  annualHighDayFractions: number[];
  annualNormalRevenues: number[];
  annualHighRevenues: number[];
}

function runTrial(trialIndex: number, config: SimulationConfig): TrialResult {
  const seed = (config.baseSeed + trialIndex) >>> 0;
  const rng = new SeededRNG(seed);

  const annualRevenues: number[] = new Array(10).fill(0) as number[];
  const annualHighDayFractions: number[] = new Array(10).fill(0) as number[];
  const annualNormalRevenues: number[] = new Array(10).fill(0) as number[];
  const annualHighRevenues: number[] = new Array(10).fill(0) as number[];

  const { momentum } = config;

  // Non-reverting annual drift.
  // At the end of each year, the trial's realized annual log-revenue per day is
  // compared to the stationary baseline. The deviation is scaled by pathWeight
  // and ACCUMULATED permanently — there is no mean reversion. High-revenue
  // trials compound upward; low-revenue trials compound downward.
  // When disabled: no extra RNG draws, preserving bit-exact backward compatibility.
  let cumulativeDrift = 0;

  // Initialize regime from stationary distribution of year 1, day 1
  const year0 = config.years[0];
  if (!year0) throw new Error('No year params for year 1');
  const day1Season = getSeasonForDay(1, config.seasonDefinition);
  const initMatrix = day1Season === 'summer' ? year0.summer : year0.other;
  let currentRegime = sampleInitialRegime(initMatrix, rng);
  let consecutiveDays = 1;

  for (let yi = 0; yi < 10; yi++) {
    const yearParams = config.years[yi];
    if (!yearParams) throw new Error(`Missing year params for year ${yi + 1}`);

    // Stationary-weighted baseline log-mean for this year.
    // Used to measure how far this trial's realized revenues deviate from baseline.
    // Average summer and other season stationary distributions for a balanced estimate.
    const [piN_s, piH_s] = stationaryDistribution(yearParams.summer);
    const [piN_o, piH_o] = stationaryDistribution(yearParams.other);
    const piN = (piN_s + piN_o) / 2;
    const piH = (piH_s + piH_o) / 2;
    const baselineLogMean = piN * yearParams.normal.mu + piH * yearParams.high.mu;

    let annualRevenue = 0;
    let highDays = 0;
    let normalRevenue = 0;
    let highRevenue = 0;

    for (let d = 1; d <= 365; d++) {
      const season = getSeasonForDay(d, config.seasonDefinition);
      const matrix = season === 'summer' ? yearParams.summer : yearParams.other;

      // Transition to next regime
      const newRegime = sampleNextRegime(currentRegime, consecutiveDays, matrix, rng);
      if (newRegime === currentRegime) {
        consecutiveDays++;
      } else {
        consecutiveDays = 1;
      }
      currentRegime = newRegime;

      // Apply cumulative drift — permanently shifted mu from all prior years.
      // cumulativeDrift = 0 in year 1 (no history yet); grows from year 2 onward.
      const baseParams = currentRegime === 'high' ? yearParams.high : yearParams.normal;
      const revenue = sampleLogNormal(
        { mu: baseParams.mu + cumulativeDrift, sigma: baseParams.sigma },
        rng,
      );

      annualRevenue += revenue;
      if (currentRegime === 'high') {
        highDays++;
        highRevenue += revenue;
      } else {
        normalRevenue += revenue;
      }
    }

    // After the year: accumulate drift from this year's realized revenues.
    // The per-day log-revenue deviation from baseline compounds permanently into
    // future years — no EMA decay, no reversion.
    if (momentum.enabled) {
      const annualLogRevPerDay = Math.log(annualRevenue / 365);
      cumulativeDrift += momentum.pathWeight * (annualLogRevPerDay - baselineLogMean);
    }

    annualRevenues[yi] = annualRevenue;
    annualHighDayFractions[yi] = highDays / 365;
    annualNormalRevenues[yi] = normalRevenue;
    annualHighRevenues[yi] = highRevenue;
  }

  return { annualRevenues, annualHighDayFractions, annualNormalRevenues, annualHighRevenues };
}

/**
 * Run the full simulation synchronously.
 * For use in a Web Worker (non-blocking) or directly in tests.
 */
export function runSimulation(
  config: SimulationConfig,
  onProgress?: (completed: number) => void
): Omit<SimulationResult, 'configHash'> {
  const trialData: TrialData[] = [];

  for (let t = 1; t <= config.numTrials; t++) {
    const result = runTrial(t, config);
    trialData.push({ trial: t, ...result });
    if (onProgress && t % 100 === 0) onProgress(t);
  }

  // Compute annual statistics
  const annualResults: AnnualResult[] = [];
  for (let yi = 0; yi < 10; yi++) {
    const revenues = trialData.map((td) => td.annualRevenues[yi]!);
    const highFractions = trialData.map((td) => td.annualHighDayFractions[yi]!);
    const normalRevenues = trialData.map((td) => td.annualNormalRevenues[yi]!);
    const highRevenues = trialData.map((td) => td.annualHighRevenues[yi]!);

    const stats = describeDistribution(revenues);
    const normalStats = computeRegimeStats(normalRevenues);
    const highStats = computeRegimeStats(highRevenues);
    const meanHighFraction = highFractions.reduce((s, v) => s + v, 0) / highFractions.length;
    const histogramBins = buildHistogram(revenues, 30);

    annualResults.push({
      year: yi + 1,
      calendarYear: config.startYear + yi,
      ...stats,
      meanHighFraction,
      histogramBins,
      normalStats,
      highStats,
    });
  }

  return {
    runTimestamp: new Date().toISOString(),
    annualResults,
    trialData,
  };
}
