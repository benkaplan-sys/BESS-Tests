import { describe, it, expect } from 'vitest';
import { runSimulation } from '@/core/simulator';
import { CANONICAL_CONFIG } from '../fixtures/validInputs';

describe('runSimulation', () => {
  it('produces bit-identical output for same seed and config', () => {
    const result1 = runSimulation(CANONICAL_CONFIG);
    const result2 = runSimulation(CANONICAL_CONFIG);
    expect(result1.annualResults).toEqual(result2.annualResults);
    expect(result1.trialData).toEqual(result2.trialData);
  });

  it('produces different output for different seed', () => {
    const result1 = runSimulation(CANONICAL_CONFIG);
    const result2 = runSimulation({ ...CANONICAL_CONFIG, baseSeed: 999 });
    expect(result1.annualResults[0]?.p50).not.toBe(result2.annualResults[0]?.p50);
  });

  it('returns exactly 10 annual results', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    expect(result.annualResults).toHaveLength(10);
  });

  it('annual revenues are all positive', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    for (const trial of result.trialData) {
      for (const rev of trial.annualRevenues) {
        expect(rev).toBeGreaterThan(0);
      }
    }
  });

  it('per-regime revenues sum to total', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    for (const trial of result.trialData) {
      for (let yi = 0; yi < 10; yi++) {
        const total = trial.annualRevenues[yi]!;
        const normal = trial.annualNormalRevenues[yi]!;
        const high = trial.annualHighRevenues[yi]!;
        expect(Math.abs(normal + high - total)).toBeLessThan(0.001);
      }
    }
  });

  it('includes normalStats and highStats per year', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    for (const ar of result.annualResults) {
      expect(ar.normalStats).toBeDefined();
      expect(ar.highStats).toBeDefined();
      // Both regime revenue totals should be positive
      expect(ar.normalStats.p50).toBeGreaterThan(0);
      expect(ar.highStats.p50).toBeGreaterThan(0);
      // Normal regime has more days (~87%), so annual normal revenue > annual high revenue
      expect(ar.normalStats.p50).toBeGreaterThan(ar.highStats.p50);
    }
  });

  it('statistics are ordered P10 <= P25 <= P50 <= P75 <= P90', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    for (const ar of result.annualResults) {
      expect(ar.p10).toBeLessThanOrEqual(ar.p25);
      expect(ar.p25).toBeLessThanOrEqual(ar.p50);
      expect(ar.p50).toBeLessThanOrEqual(ar.p75);
      expect(ar.p75).toBeLessThanOrEqual(ar.p90);
    }
  });

  it('produces correct number of trials', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    expect(result.trialData).toHaveLength(CANONICAL_CONFIG.numTrials);
  });

  it('calls progress callback', () => {
    const progressValues: number[] = [];
    runSimulation(CANONICAL_CONFIG, (n) => progressValues.push(n));
    expect(progressValues.length).toBeGreaterThan(0);
    expect(progressValues[progressValues.length - 1]).toBe(CANONICAL_CONFIG.numTrials);
  });

  it('momentum widens the fan — year-10 P90/P10 spread is larger with momentum enabled', () => {
    const withMomentum = runSimulation({
      ...CANONICAL_CONFIG,
      numTrials: 300,
      momentum: { enabled: true, pathWeight: 0.30 },
    });
    const withoutMomentum = runSimulation({
      ...CANONICAL_CONFIG,
      numTrials: 300,
      momentum: { enabled: false, pathWeight: 0.30 },
    });
    const spreadWith = withMomentum.annualResults[9]!.p90 - withMomentum.annualResults[9]!.p10;
    const spreadWithout = withoutMomentum.annualResults[9]!.p90 - withoutMomentum.annualResults[9]!.p10;
    expect(spreadWith).toBeGreaterThan(spreadWithout * 1.05);
  });

  it('momentum disabled — pathWeight value does not affect output (bit-identical)', () => {
    const r1 = runSimulation({ ...CANONICAL_CONFIG, momentum: { enabled: false, pathWeight: 0.10 } });
    const r2 = runSimulation({ ...CANONICAL_CONFIG, momentum: { enabled: false, pathWeight: 0.90 } });
    expect(r1.annualResults[0]?.p50).toBe(r2.annualResults[0]?.p50);
  });

  it('momentum creates path persistence — top-half year-1 trials stay above bottom-half in year 10', () => {
    const result = runSimulation({
      ...CANONICAL_CONFIG,
      numTrials: 400,
      momentum: { enabled: true, pathWeight: 0.30 },
    });
    const trials = result.trialData;
    const sorted = [...trials].sort((a, b) => a.annualRevenues[0]! - b.annualRevenues[0]!);
    const half = Math.floor(sorted.length / 2);
    const bottomHalf = sorted.slice(0, half);
    const topHalf = sorted.slice(half);
    const avgY10Bottom = bottomHalf.reduce((s, t) => s + t.annualRevenues[9]!, 0) / half;
    const avgY10Top    = topHalf.reduce((s, t) => s + t.annualRevenues[9]!, 0) / half;
    expect(avgY10Top).toBeGreaterThan(avgY10Bottom);
  });

  it('fan widens over time — year-10 spread > year-1 spread with momentum', () => {
    const result = runSimulation({
      ...CANONICAL_CONFIG,
      numTrials: 300,
      momentum: { enabled: true, pathWeight: 0.30 },
    });
    const spread1  = result.annualResults[0]!.p90 - result.annualResults[0]!.p10;
    const spread10 = result.annualResults[9]!.p90 - result.annualResults[9]!.p10;
    expect(spread10).toBeGreaterThan(spread1);
  });
});
