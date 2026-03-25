import { DescriptiveStats, HistogramBin } from './types';

// Re-export the interface for use elsewhere
export type { DescriptiveStats };

/**
 * Compute the p-th percentile (p in [0, 1]) from a sorted array
 * using linear interpolation (same as numpy default).
 */
export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) throw new Error('Cannot compute percentile of empty array');
  if (p < 0 || p > 1) throw new Error(`p must be in [0, 1], got ${p}`);
  if (sortedValues.length === 1) return sortedValues[0]!;

  const idx = p * (sortedValues.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const frac = idx - lo;

  const loVal = sortedValues[lo]!;
  const hiVal = sortedValues[hi]!;
  return loVal + frac * (hiVal - loVal);
}

/**
 * Compute descriptive statistics from a (unsorted or sorted) array of values.
 * Sorts internally — does not mutate the input array.
 */
export function describeDistribution(values: number[]): DescriptiveStats {
  if (values.length === 0) throw new Error('Cannot describe empty array');

  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const mean = sorted.reduce((s, v) => s + v, 0) / n;
  const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);

  return {
    p10: percentile(sorted, 0.1),
    p25: percentile(sorted, 0.25),
    p50: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    mean,
    std,
    min: sorted[0]!,
    max: sorted[n - 1]!,
  };
}

/**
 * Build a histogram from values with a specified number of bins.
 */
export function buildHistogram(values: number[], numBins: number = 30): HistogramBin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ binStart: min, binEnd: max, count: values.length, frequency: 1 }];
  }

  const binWidth = (max - min) / numBins;
  const bins: HistogramBin[] = Array.from({ length: numBins }, (_, i) => ({
    binStart: min + i * binWidth,
    binEnd: min + (i + 1) * binWidth,
    count: 0,
    frequency: 0,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    const bin = bins[idx];
    if (bin) bin.count++;
  }

  for (const bin of bins) {
    bin.frequency = bin.count / values.length;
  }

  return bins;
}
