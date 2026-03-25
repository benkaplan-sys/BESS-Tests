import { describe, it, expect } from 'vitest';
import { SeededRNG } from '@/core/rng';

describe('SeededRNG', () => {
  describe('reproducibility', () => {
    it('produces identical sequences for identical seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(42);
      for (let i = 0; i < 100; i++) {
        expect(rng1.next()).toBe(rng2.next());
      }
    });

    it('produces different sequences for different seeds', () => {
      const rng1 = new SeededRNG(42);
      const rng2 = new SeededRNG(43);
      const seq1 = Array.from({ length: 20 }, () => rng1.next());
      const seq2 = Array.from({ length: 20 }, () => rng2.next());
      expect(seq1).not.toEqual(seq2);
    });

    it('snapshot: seed=42 produces known first value', () => {
      const rng = new SeededRNG(42);
      const first = rng.next();
      // Snapshot: value must be in [0, 1)
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThan(1);
      // Record exact value for regression
      expect(first).toMatchSnapshot();
    });

    it('snapshot: seed=0', () => {
      const rng = new SeededRNG(0);
      expect(rng.next()).toMatchSnapshot();
    });

    it('snapshot: seed=1', () => {
      const rng = new SeededRNG(1);
      expect(rng.next()).toMatchSnapshot();
    });

    it('snapshot: seed=2^32-1', () => {
      const rng = new SeededRNG(4294967295);
      expect(rng.next()).toMatchSnapshot();
    });
  });

  describe('next()', () => {
    it('always returns values in [0, 1)', () => {
      const rng = new SeededRNG(99);
      for (let i = 0; i < 10000; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  describe('nextInt()', () => {
    it('returns integers in [0, max)', () => {
      const rng = new SeededRNG(7);
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextInt(10);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(10);
        expect(Number.isInteger(v)).toBe(true);
      }
    });
  });

  describe('nextNormal()', () => {
    it('produces approximately standard normal distribution', () => {
      const rng = new SeededRNG(123);
      const samples = Array.from({ length: 10000 }, () => rng.nextNormal());
      const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
      const variance =
        samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
      const std = Math.sqrt(variance);

      expect(Math.abs(mean)).toBeLessThan(0.05); // mean ≈ 0
      expect(Math.abs(std - 1)).toBeLessThan(0.05); // std ≈ 1
    });
  });

  describe('nextLogNormal()', () => {
    it('always produces positive values', () => {
      const rng = new SeededRNG(5);
      for (let i = 0; i < 1000; i++) {
        expect(rng.nextLogNormal(10, 0.5)).toBeGreaterThan(0);
      }
    });
  });

  describe('clone()', () => {
    it('cloned RNG produces same sequence', () => {
      const rng = new SeededRNG(77);
      rng.next(); rng.next(); // advance
      const clone = rng.clone();
      for (let i = 0; i < 50; i++) {
        expect(rng.next()).toBe(clone.next());
      }
    });
  });
});
