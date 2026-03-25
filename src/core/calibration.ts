// ============================================================
// Calibration Engine — derive SimulationConfig from backcast CSV
// ============================================================

import {
  SeasonDefinition,
  YearParams,
  TransitionMatrix,
  flatProbs,
} from './types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyRecord {
  date: Date;
  revenue: number;
  year: number;
  month: number; // 1-12
}

export interface ClassifiedRecord extends DailyRecord {
  regime: 'normal' | 'high';
}

export interface AnnualCalibStats {
  calYear: number;
  normalCount: number;
  highCount: number;
  highFraction: number;
  normalLogMean: number;  // mu
  normalLogSd: number;    // sigma
  highLogMean: number;
  highLogSd: number;
  normalDollarMean: number;  // exp(mu + 0.5*sigma^2)
  highDollarMean: number;
  totalDollarMean: number;   // weighted by fraction
}

export interface CalibrationOptions {
  thresholdPct: number;      // 0.5–0.95, default 0.75
  recentYearsCount: number;  // 1–10, default 3
  growthRatePerYear: number; // 0–0.20, default 0
}

export const DEFAULT_CALIBRATION_OPTIONS: CalibrationOptions = {
  thresholdPct: 0.75,
  recentYearsCount: 3,
  growthRatePerYear: 0,
};

export interface CalibrationResult {
  records: ClassifiedRecord[];
  annualStats: AnnualCalibStats[];
  highThreshold: number;
  seasonDefinition: SeasonDefinition;
  summerHazards: { nToH: number[]; hToN: number[] };
  otherHazards: { nToH: number[]; hToN: number[] };
  forwardYearParams: YearParams[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function fitLogNormal(values: number[]): { mu: number; sigma: number } {
  if (values.length === 0) return { mu: 0, sigma: 0.01 };

  const logVals = values.map((v) => Math.log(Math.max(v, 1e-9)));
  const mu = logVals.reduce((s, x) => s + x, 0) / logVals.length;

  if (logVals.length < 2) return { mu, sigma: 0.01 };

  const variance =
    logVals.reduce((s, x) => s + (x - mu) ** 2, 0) / (logVals.length - 1);
  const sigma = Math.max(Math.sqrt(variance), 0.01);

  return { mu, sigma };
}

function sortedCopy(values: number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Parse a CSV with header `Date,Revenue (USD/MW-day)`.
 * Skips rows with unparseable dates or non-positive revenues.
 * Returns records sorted ascending by date.
 */
export function parseBackcastCSV(text: string): DailyRecord[] {
  const lines = text.split(/\r?\n/);
  const records: DailyRecord[] = [];

  // Find header row (skip blank lines)
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '') continue;
    // First non-blank line is the header
    dataStart = i + 1;
    break;
  }

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '') continue;

    const parts = line.split(',');
    if (parts.length < 2) continue;

    const dateStr = parts[0]!.trim();
    const revenueStr = parts[1]!.trim();

    const date = new Date(dateStr);
    if (isNaN(date.getTime())) continue;

    const revenue = parseFloat(revenueStr);
    if (!isFinite(revenue) || revenue <= 0) continue;

    records.push({
      date,
      revenue,
      year: date.getFullYear(),
      month: date.getMonth() + 1, // 1-12
    });
  }

  records.sort((a, b) => a.date.getTime() - b.date.getTime());
  return records;
}

/**
 * Compute the revenue value at the given percentile (0–1) from an array of
 * daily records. Uses linear interpolation.
 */
export function computePercentileThreshold(
  records: DailyRecord[],
  pct: number,
): number {
  if (records.length === 0) return 0;

  const sorted = sortedCopy(records.map((r) => r.revenue));
  const n = sorted.length;
  const idx = pct * (n - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;

  const loVal = sorted[lo] ?? 0;
  const hiVal = sorted[hi] ?? loVal;
  return loVal + frac * (hiVal - loVal);
}

/**
 * Classify each day's record as 'normal' or 'high' based on a revenue threshold.
 */
export function classifyRegimes(
  records: DailyRecord[],
  threshold: number,
): ClassifiedRecord[] {
  return records.map((r) => ({
    ...r,
    regime: r.revenue >= threshold ? 'high' : 'normal',
  }));
}

/**
 * Fit log-normal MLE parameters per calendar year.
 * If a year has fewer than 5 high-regime days, falls back to normal params for high.
 */
export function computeAnnualStats(
  records: ClassifiedRecord[],
): AnnualCalibStats[] {
  // Group by calendar year
  const byYear = new Map<number, ClassifiedRecord[]>();
  for (const r of records) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year)!.push(r);
  }

  const result: AnnualCalibStats[] = [];

  for (const [calYear, yearRecords] of byYear) {
    const normalRevs = yearRecords
      .filter((r) => r.regime === 'normal')
      .map((r) => r.revenue);
    const highRevs = yearRecords
      .filter((r) => r.regime === 'high')
      .map((r) => r.revenue);

    const normalFit = fitLogNormal(normalRevs);
    const highFit =
      highRevs.length >= 5 ? fitLogNormal(highRevs) : { ...normalFit };

    const normalDollarMean = Math.exp(
      normalFit.mu + 0.5 * normalFit.sigma ** 2,
    );
    const highDollarMean = Math.exp(highFit.mu + 0.5 * highFit.sigma ** 2);
    const highFraction =
      yearRecords.length > 0 ? highRevs.length / yearRecords.length : 0;
    const totalDollarMean =
      (1 - highFraction) * normalDollarMean + highFraction * highDollarMean;

    result.push({
      calYear,
      normalCount: normalRevs.length,
      highCount: highRevs.length,
      highFraction,
      normalLogMean: normalFit.mu,
      normalLogSd: normalFit.sigma,
      highLogMean: highFit.mu,
      highLogSd: highFit.sigma,
      normalDollarMean,
      highDollarMean,
      totalDollarMean,
    });
  }

  result.sort((a, b) => a.calYear - b.calYear);
  return result;
}

/**
 * Compute duration-dependent empirical transition hazards from sorted records.
 *
 * Walk through sorted records tracking consecutive regime runs.
 * For each run of length L ending in a transition at day d:
 *   at_risk[min(i-1, 9)]++ for i = 1..L
 *   events[min(L-1, 9)]++
 * Hazard = events / at_risk, clamped to [0.003, 0.95].
 * If at_risk < 10 at any bin, use floor of 0.05.
 */
export function computeTransitionHazards(
  records: ClassifiedRecord[],
  seasonFilter?: 'summer' | 'other',
  seasonDef?: SeasonDefinition,
): { nToH: number[]; hToN: number[] } {
  const BINS = 10;

  const nToH_atRisk = new Array(BINS).fill(0) as number[];
  const nToH_events = new Array(BINS).fill(0) as number[];
  const hToN_atRisk = new Array(BINS).fill(0) as number[];
  const hToN_events = new Array(BINS).fill(0) as number[];

  // Filter by season if requested
  const filtered =
    seasonFilter && seasonDef
      ? records.filter((r) => {
          const s = seasonDef[r.month] ?? 'other';
          return s === seasonFilter;
        })
      : records;

  if (filtered.length === 0) {
    return {
      nToH: new Array(BINS).fill(0.05) as number[],
      hToN: new Array(BINS).fill(0.3) as number[],
    };
  }

  // Walk through records building runs
  let runStart = 0;
  let currentRegime = filtered[0]!.regime;

  for (let i = 1; i <= filtered.length; i++) {
    const nextRegime = i < filtered.length ? filtered[i]!.regime : null;
    const isTransition = nextRegime !== null && nextRegime !== currentRegime;
    const isEnd = nextRegime === null;

    if (isTransition || isEnd) {
      const runLength = i - runStart;

      if (isTransition) {
        // Record this completed run
        const atRiskArr =
          currentRegime === 'normal' ? nToH_atRisk : hToN_atRisk;
        const eventsArr =
          currentRegime === 'normal' ? nToH_events : hToN_events;

        for (let dur = 1; dur <= runLength; dur++) {
          const bin = Math.min(dur - 1, BINS - 1);
          atRiskArr[bin]!++;
        }
        const eventBin = Math.min(runLength - 1, BINS - 1);
        eventsArr[eventBin]!++;
      }

      runStart = i;
      if (nextRegime !== null) currentRegime = nextRegime;
    }
  }

  const buildHazard = (atRisk: number[], events: number[]): number[] => {
    return atRisk.map((ar, i) => {
      const ev = events[i] ?? 0;
      if (ar < 10) return 0.05;
      const h = ev / ar;
      return Math.min(Math.max(h, 0.003), 0.95);
    });
  };

  return {
    nToH: buildHazard(nToH_atRisk, nToH_events),
    hToN: buildHazard(hToN_atRisk, hToN_events),
  };
}

/**
 * Detect which months qualify as 'summer' by ranking months by mean revenue.
 * The top 4 months by mean revenue are labeled 'summer'.
 */
export function detectSeasonality(records: DailyRecord[]): SeasonDefinition {
  const monthSums = new Array(13).fill(0) as number[];
  const monthCounts = new Array(13).fill(0) as number[];

  for (const r of records) {
    monthSums[r.month]! += r.revenue;
    monthCounts[r.month]!++;
  }

  const monthMeans: { month: number; mean: number }[] = [];
  for (let m = 1; m <= 12; m++) {
    const count = monthCounts[m] ?? 0;
    const mean = count > 0 ? (monthSums[m] ?? 0) / count : 0;
    monthMeans.push({ month: m, mean });
  }

  // Sort descending by mean revenue — top 4 are summer
  monthMeans.sort((a, b) => b.mean - a.mean);
  const summerMonths = new Set(
    monthMeans.slice(0, 4).map((x) => x.month),
  );

  const def: SeasonDefinition = {};
  for (let m = 1; m <= 12; m++) {
    def[m] = summerMonths.has(m) ? 'summer' : 'other';
  }
  return def;
}

/**
 * Generate 10-year forward YearParams from the calibrated stats.
 * Uses the average of the last `recentYearsCount` years as a base,
 * then applies `growthRatePerYear` in log-space.
 */
export function generateForwardParams(
  annualStats: AnnualCalibStats[],
  options: CalibrationOptions,
  summerHazards: { nToH: number[]; hToN: number[] },
  otherHazards: { nToH: number[]; hToN: number[] },
  seasonDef: SeasonDefinition,
): YearParams[] {
  void seasonDef; // used for context, transitions already computed

  const { recentYearsCount, growthRatePerYear } = options;

  const recent = annualStats.slice(-Math.max(1, recentYearsCount));

  // Average the log-space params over recent years
  const baseMuNormal =
    recent.reduce((s, y) => s + y.normalLogMean, 0) / recent.length;
  const baseSigmaNormal =
    recent.reduce((s, y) => s + y.normalLogSd, 0) / recent.length;
  const baseMuHigh =
    recent.reduce((s, y) => s + y.highLogMean, 0) / recent.length;
  const baseSigmaHigh =
    recent.reduce((s, y) => s + y.highLogSd, 0) / recent.length;

  const logGrowth = Math.log(1 + growthRatePerYear);

  const summerMatrix: TransitionMatrix = {
    pNormalToHigh: [...summerHazards.nToH] as number[],
    pHighToNormal: [...summerHazards.hToN] as number[],
  };
  const otherMatrix: TransitionMatrix = {
    pNormalToHigh: [...otherHazards.nToH] as number[],
    pHighToNormal: [...otherHazards.hToN] as number[],
  };

  // Fallback if hazard arrays are empty
  const safeSummerNtoH =
    summerMatrix.pNormalToHigh.length === 10
      ? summerMatrix
      : { pNormalToHigh: flatProbs(0.05), pHighToNormal: flatProbs(0.3) };
  const safeOtherNtoH =
    otherMatrix.pNormalToHigh.length === 10
      ? otherMatrix
      : { pNormalToHigh: flatProbs(0.02), pHighToNormal: flatProbs(0.4) };

  const params: YearParams[] = [];
  for (let i = 0; i < 10; i++) {
    const muNormal = baseMuNormal + logGrowth * i;
    const muHigh = baseMuHigh + logGrowth * i;

    params.push({
      year: i + 1,
      normal: { mu: muNormal, sigma: Math.max(baseSigmaNormal, 0.01) },
      high: { mu: muHigh, sigma: Math.max(baseSigmaHigh, 0.01) },
      summer: { ...safeSummerNtoH },
      other: { ...safeOtherNtoH },
    });
  }

  return params;
}

/**
 * Orchestrate the full calibration pipeline.
 */
export function calibrate(
  records: DailyRecord[],
  options: CalibrationOptions,
): CalibrationResult {
  const highThreshold = computePercentileThreshold(records, options.thresholdPct);
  const classified = classifyRegimes(records, highThreshold);
  const annualStats = computeAnnualStats(classified);
  const seasonDefinition = detectSeasonality(records);

  const summerHazards = computeTransitionHazards(classified, 'summer', seasonDefinition);
  const otherHazards = computeTransitionHazards(classified, 'other', seasonDefinition);

  const forwardYearParams = generateForwardParams(
    annualStats,
    options,
    summerHazards,
    otherHazards,
    seasonDefinition,
  );

  return {
    records: classified,
    annualStats,
    highThreshold,
    seasonDefinition,
    summerHazards,
    otherHazards,
    forwardYearParams,
  };
}
