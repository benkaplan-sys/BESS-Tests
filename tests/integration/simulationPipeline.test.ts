import { describe, it, expect } from 'vitest';
import { runSimulation } from '@/core/simulator';
import { CANONICAL_CONFIG } from '../fixtures/validInputs';

describe('simulationPipeline integration', () => {
  it('matches snapshot for canonical config (seed=42, 100 trials)', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    expect(result.annualResults[0]?.p50).toMatchSnapshot();
    expect(result.annualResults[0]?.p10).toMatchSnapshot();
    expect(result.annualResults[0]?.p90).toMatchSnapshot();
  });

  it('full result structure is valid', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    expect(result.runTimestamp).toBeTruthy();
    expect(result.annualResults).toHaveLength(10);
    expect(result.trialData).toHaveLength(CANONICAL_CONFIG.numTrials);
    for (const ar of result.annualResults) {
      expect(ar.year).toBeGreaterThanOrEqual(1);
      expect(ar.year).toBeLessThanOrEqual(10);
      expect(ar.histogramBins.length).toBeGreaterThan(0);
      expect(ar.meanHighFraction).toBeGreaterThanOrEqual(0);
      expect(ar.meanHighFraction).toBeLessThanOrEqual(1);
      expect(ar.normalStats).toBeDefined();
      expect(ar.highStats).toBeDefined();
    }
  });

  it('per-regime revenues sum to combined', () => {
    const result = runSimulation(CANONICAL_CONFIG);
    for (const trial of result.trialData) {
      for (let yi = 0; yi < 10; yi++) {
        const sum = trial.annualNormalRevenues[yi]! + trial.annualHighRevenues[yi]!;
        expect(Math.abs(sum - trial.annualRevenues[yi]!)).toBeLessThan(0.001);
      }
    }
  });
});
