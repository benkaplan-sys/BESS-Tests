import { describe, it, expect } from 'vitest';
import { percentile, describeDistribution, buildHistogram } from '@/core/statistics';

describe('statistics', () => {
  describe('percentile', () => {
    it('returns median of [1,2,3,4,5]', () => {
      expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    });

    it('returns min for p=0', () => {
      expect(percentile([1, 2, 3], 0)).toBe(1);
    });

    it('returns max for p=1', () => {
      expect(percentile([1, 2, 3], 1)).toBe(3);
    });

    it('interpolates correctly', () => {
      // p=0.25 of [1,2,3,4,5] = 1 + 0.25*4 = 2
      expect(percentile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    });

    it('handles single-element array', () => {
      expect(percentile([42], 0.5)).toBe(42);
    });

    it('handles all-identical values', () => {
      expect(percentile([7, 7, 7], 0.5)).toBe(7);
    });

    it('throws for empty array', () => {
      expect(() => percentile([], 0.5)).toThrow();
    });

    it('throws for p out of range', () => {
      expect(() => percentile([1, 2, 3], -0.1)).toThrow();
      expect(() => percentile([1, 2, 3], 1.1)).toThrow();
    });
  });

  describe('describeDistribution', () => {
    it('computes correct stats for [1,2,3,4,5]', () => {
      const stats = describeDistribution([1, 2, 3, 4, 5]);
      expect(stats.mean).toBe(3);
      expect(stats.min).toBe(1);
      expect(stats.max).toBe(5);
      expect(stats.p50).toBe(3);
    });

    it('percentiles are ordered p10 <= p25 <= p50 <= p75 <= p90', () => {
      const values = Array.from({ length: 1000 }, (_, i) => i + 1);
      const stats = describeDistribution(values);
      expect(stats.p10).toBeLessThanOrEqual(stats.p25);
      expect(stats.p25).toBeLessThanOrEqual(stats.p50);
      expect(stats.p50).toBeLessThanOrEqual(stats.p75);
      expect(stats.p75).toBeLessThanOrEqual(stats.p90);
    });

    it('throws for empty array', () => {
      expect(() => describeDistribution([])).toThrow();
    });
  });

  describe('buildHistogram', () => {
    it('returns correct number of bins', () => {
      const values = Array.from({ length: 1000 }, (_, i) => i);
      const bins = buildHistogram(values, 10);
      expect(bins.length).toBe(10);
    });

    it('frequencies sum to 1', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const bins = buildHistogram(values, 5);
      const total = bins.reduce((s, b) => s + b.frequency, 0);
      expect(total).toBeCloseTo(1, 10);
    });

    it('handles empty array', () => {
      expect(buildHistogram([], 10)).toEqual([]);
    });

    it('handles all-identical values', () => {
      const bins = buildHistogram([5, 5, 5], 10);
      expect(bins.length).toBe(1);
    });
  });
});
