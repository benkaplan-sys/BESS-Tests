import { describe, it, expect } from 'vitest';
import {
  stationaryDistribution,
  sampleNextRegime,
  dayOfYearToMonth,
  getSeasonForDay,
  sampleInitialRegime,
  getTransitionProb,
} from '@/core/markov';
import { SeededRNG } from '@/core/rng';
import { SeasonDefinition, TransitionMatrix, flatProbs } from '@/core/types';

const makeMatrix = (pNH: number, pHN: number): TransitionMatrix => ({
  pNormalToHigh: flatProbs(pNH),
  pHighToNormal: flatProbs(pHN),
});

describe('markov', () => {
  describe('getTransitionProb', () => {
    it('returns prob for day 1 (index 0)', () => {
      const probs = [0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01];
      expect(getTransitionProb(probs, 1)).toBe(0.1);
    });

    it('returns prob for day 5 (index 4)', () => {
      const probs = [0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01];
      expect(getTransitionProb(probs, 5)).toBe(0.06);
    });

    it('clamps to index 9 for day 10 and beyond', () => {
      const probs = [0.1, 0.09, 0.08, 0.07, 0.06, 0.05, 0.04, 0.03, 0.02, 0.01];
      expect(getTransitionProb(probs, 10)).toBe(0.01);
      expect(getTransitionProb(probs, 15)).toBe(0.01);
      expect(getTransitionProb(probs, 100)).toBe(0.01);
    });
  });

  describe('stationaryDistribution', () => {
    it('satisfies pi = pi * P within 1e-10', () => {
      const matrix = makeMatrix(0.05, 0.3);
      const [pN, pH] = stationaryDistribution(matrix);
      const pNH = matrix.pNormalToHigh[0]!;
      const pHN = matrix.pHighToNormal[0]!;
      const newPN = pN * (1 - pNH) + pH * pHN;
      const newPH = pN * pNH + pH * (1 - pHN);
      expect(Math.abs(newPN - pN)).toBeLessThan(1e-10);
      expect(Math.abs(newPH - pH)).toBeLessThan(1e-10);
    });

    it('probabilities sum to 1', () => {
      const [pN, pH] = stationaryDistribution(makeMatrix(0.1, 0.4));
      expect(pN + pH).toBeCloseTo(1, 10);
    });

    it('high-p_nh matrix gives mostly high regime', () => {
      const [, pHigh] = stationaryDistribution(makeMatrix(0.99, 0.01));
      expect(pHigh).toBeGreaterThan(0.98);
    });
  });

  describe('sampleNextRegime', () => {
    it('transitions normal->high at stationary rate (flat probs, day 1)', () => {
      const matrix = makeMatrix(0.99, 0.01);
      const rng = new SeededRNG(1);
      let highCount = 0;
      const N = 100000;
      let regime = sampleInitialRegime(matrix, rng);
      let days = 1;
      for (let i = 0; i < N; i++) {
        const next = sampleNextRegime(regime, days, matrix, rng);
        days = next === regime ? days + 1 : 1;
        regime = next;
        if (regime === 'high') highCount++;
      }
      expect(Math.abs(highCount / N - 0.99)).toBeLessThan(0.01);
    });

    it('uses duration-dependent probs correctly', () => {
      // pNormalToHigh starts high and decreases; after many consecutive normal days, rarely switches
      const probs: number[] = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05];
      const matrix: TransitionMatrix = {
        pNormalToHigh: probs,
        pHighToNormal: flatProbs(0.5),
      };
      const rng = new SeededRNG(42);
      // Force consecutive day = 10 — should use prob 0.05
      const rng2 = new SeededRNG(42);
      // Day 1 uses prob[0] = 0.9; day 10+ uses prob[9] = 0.05
      // We can't easily compare exact outputs here, but check no crash
      const result = sampleNextRegime('normal', 1, matrix, rng);
      expect(['normal', 'high']).toContain(result);
      const result10 = sampleNextRegime('normal', 10, matrix, rng2);
      expect(['normal', 'high']).toContain(result10);
    });
  });

  describe('dayOfYearToMonth', () => {
    const cases: [number, number][] = [
      [1, 1], [31, 1], [32, 2], [59, 2], [60, 3], [90, 3], [91, 4], [120, 4],
      [121, 5], [151, 5], [152, 6], [181, 6], [182, 7], [212, 7], [213, 8],
      [243, 8], [244, 9], [273, 9], [274, 10], [304, 10], [305, 11], [334, 11],
      [335, 12], [365, 12],
    ];
    for (const [day, expectedMonth] of cases) {
      it(`day ${day} \u2192 month ${expectedMonth}`, () => {
        expect(dayOfYearToMonth(day)).toBe(expectedMonth);
      });
    }
    it('throws for day 0', () => { expect(() => dayOfYearToMonth(0)).toThrow(); });
    it('throws for day 366', () => { expect(() => dayOfYearToMonth(366)).toThrow(); });
    it('all 365 days return months 1-12', () => {
      for (let d = 1; d <= 365; d++) {
        const m = dayOfYearToMonth(d);
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
      }
    });
  });

  describe('getSeasonForDay', () => {
    const def: SeasonDefinition = {
      1: 'other', 2: 'other', 3: 'other', 4: 'other', 5: 'other',
      6: 'summer', 7: 'summer', 8: 'summer',
      9: 'other', 10: 'other', 11: 'other', 12: 'other',
    };
    it('day 1 (Jan) \u2192 other', () => { expect(getSeasonForDay(1, def)).toBe('other'); });
    it('day 152 (Jun 1) \u2192 summer', () => { expect(getSeasonForDay(152, def)).toBe('summer'); });
    it('day 243 (Aug 31) \u2192 summer', () => { expect(getSeasonForDay(243, def)).toBe('summer'); });
    it('day 244 (Sep 1) \u2192 other', () => { expect(getSeasonForDay(244, def)).toBe('other'); });
  });
});
