import { describe, it, expect } from 'vitest';
import { realToLogNormal, logNormalToReal, sampleLogNormal } from '@/core/distributions';
import { SeededRNG } from '@/core/rng';

describe('distributions', () => {
  describe('realToLogNormal / logNormalToReal round-trip', () => {
    it('converts and inverts correctly for typical values', () => {
      const real = { mean: 50000, std: 15000 };
      const logParams = realToLogNormal(real);
      const back = logNormalToReal(logParams);
      expect(Math.abs(back.mean - real.mean)).toBeLessThan(0.01);
      expect(Math.abs(back.std - real.std)).toBeLessThan(0.01);
    });

    it('round-trips for various mean/std combinations', () => {
      const cases = [
        { mean: 1000, std: 200 },
        { mean: 100000, std: 50000 },
        { mean: 500, std: 100 },
        { mean: 10, std: 5 },
      ];
      for (const { mean, std } of cases) {
        const params = realToLogNormal({ mean, std });
        const result = logNormalToReal(params);
        expect(result.mean).toBeCloseTo(mean, 5);
        expect(result.std).toBeCloseTo(std, 5);
      }
    });

    it('throws for non-positive mean', () => {
      expect(() => realToLogNormal({ mean: 0, std: 100 })).toThrow();
      expect(() => realToLogNormal({ mean: -1, std: 100 })).toThrow();
    });

    it('throws for non-positive std', () => {
      expect(() => realToLogNormal({ mean: 100, std: 0 })).toThrow();
      expect(() => realToLogNormal({ mean: 100, std: -1 })).toThrow();
    });
  });

  describe('sampleLogNormal', () => {
    it('always returns positive values', () => {
      const rng = new SeededRNG(42);
      const params = { mu: 10.5, sigma: 0.4 };
      for (let i = 0; i < 1000; i++) {
        expect(sampleLogNormal(params, rng)).toBeGreaterThan(0);
      }
    });

    it('sample mean approximates expected real-space mean within 2%', () => {
      const realParams = { mean: 50000, std: 10000 };
      const logParams = realToLogNormal(realParams);
      const rng = new SeededRNG(99);
      const N = 50000;
      const samples = Array.from({ length: N }, () => sampleLogNormal(logParams, rng));
      const sampleMean = samples.reduce((s, v) => s + v, 0) / N;
      const relError = Math.abs(sampleMean - realParams.mean) / realParams.mean;
      expect(relError).toBeLessThan(0.02);
    });
  });
});
