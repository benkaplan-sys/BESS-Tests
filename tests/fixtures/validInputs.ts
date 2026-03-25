import { SimulationConfig, flatProbs } from '@/core/types';

export const CANONICAL_CONFIG: SimulationConfig = {
  baseSeed: 42,
  numTrials: 100,
  startYear: 2025,
  seasonDefinition: {
    1: 'other', 2: 'other', 3: 'other', 4: 'other', 5: 'other',
    6: 'summer', 7: 'summer', 8: 'summer',
    9: 'other', 10: 'other', 11: 'other', 12: 'other',
  },
  years: Array.from({ length: 10 }, (_, i) => ({
    year: i + 1,
    normal: { mu: 10.5, sigma: 0.4 },
    high: { mu: 12.0, sigma: 0.6 },
    summer: { pNormalToHigh: flatProbs(0.05), pHighToNormal: flatProbs(0.3) },
    other:  { pNormalToHigh: flatProbs(0.02), pHighToNormal: flatProbs(0.4) },
  })),
  momentum: { enabled: false, pathWeight: 0.20 },
};

export const MINIMAL_CONFIG: SimulationConfig = {
  baseSeed: 0,
  numTrials: 100,
  startYear: 2025,
  seasonDefinition: {
    1: 'other', 2: 'other', 3: 'other', 4: 'other', 5: 'other', 6: 'summer',
    7: 'summer', 8: 'summer', 9: 'other', 10: 'other', 11: 'other', 12: 'other',
  },
  years: Array.from({ length: 10 }, (_, i) => ({
    year: i + 1,
    normal: { mu: 10.0, sigma: 0.3 },
    high: { mu: 11.5, sigma: 0.5 },
    summer: { pNormalToHigh: flatProbs(0.03), pHighToNormal: flatProbs(0.35) },
    other:  { pNormalToHigh: flatProbs(0.01), pHighToNormal: flatProbs(0.45) },
  })),
  momentum: { enabled: false, pathWeight: 0.20 },
};
