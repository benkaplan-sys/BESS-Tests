/**
 * Migration utilities for loading configs saved with older schema versions.
 */
import {
  SimulationConfig, TransitionMatrix, MomentumConfig, YearParams,
  flatProbs, DEFAULT_MOMENTUM, TRANSITION_DURATION_STEPS,
  DEFAULT_SEASON_DEFINITION,
} from './types';

function migrateTransitionMatrix(raw: unknown): TransitionMatrix {
  if (!raw || typeof raw !== 'object') {
    return { pNormalToHigh: flatProbs(0.05), pHighToNormal: flatProbs(0.3) };
  }
  const m = raw as Record<string, unknown>;
  const normProbs = (v: unknown, fallback: number): number[] => {
    if (Array.isArray(v)) {
      const base = typeof v[0] === 'number' ? (v[0] as number) : fallback;
      return Array.from({ length: TRANSITION_DURATION_STEPS }, (_, i) =>
        typeof v[i] === 'number' ? (v[i] as number) : base
      );
    }
    if (typeof v === 'number') return flatProbs(v);
    return flatProbs(fallback);
  };
  return {
    pNormalToHigh: normProbs(m['pNormalToHigh'], 0.05),
    pHighToNormal: normProbs(m['pHighToNormal'], 0.3),
  };
}

function migrateMomentum(raw: unknown): MomentumConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_MOMENTUM };
  const m = raw as Record<string, unknown>;
  // Support all historical formats:
  // v1: { windowDays, weight }
  // v2: { annualDriftSigma }
  // v3: { lookbackDays, pathWeight } (EMA — lookbackDays is now ignored)
  // v4: { pathWeight } — current cumulative annual drift model
  const pathWeight =
    typeof m['pathWeight'] === 'number'
      ? m['pathWeight']
      : typeof m['weight'] === 'number'
      ? Math.max(0, Math.min(1, m['weight'] as number))
      : DEFAULT_MOMENTUM.pathWeight;
  return {
    enabled: typeof m['enabled'] === 'boolean' ? m['enabled'] : false,
    pathWeight,
  };
}

function defaultYearParams(year: number): YearParams {
  return {
    year,
    normal: { mu: 10.5, sigma: 0.4 },
    high: { mu: 12.0, sigma: 0.6 },
    summer: { pNormalToHigh: flatProbs(0.05), pHighToNormal: flatProbs(0.3) },
    other:  { pNormalToHigh: flatProbs(0.02), pHighToNormal: flatProbs(0.4) },
  };
}

function migrateYearParams(raw: unknown, year: number): YearParams {
  if (!raw || typeof raw !== 'object') return defaultYearParams(year);
  const y = raw as Record<string, unknown>;
  return {
    year: typeof y['year'] === 'number' ? y['year'] : year,
    normal: (y['normal'] as YearParams['normal']) ?? { mu: 10.5, sigma: 0.4 },
    high: (y['high'] as YearParams['high']) ?? { mu: 12.0, sigma: 0.6 },
    summer: migrateTransitionMatrix(y['summer']),
    other: migrateTransitionMatrix(y['other']),
  };
}

/**
 * Normalize a raw config object (possibly from an older schema) to the current SimulationConfig shape.
 * Idempotent — safe to call on already-migrated configs.
 */
export function migrateConfig(raw: unknown): SimulationConfig {
  if (!raw || typeof raw !== 'object') {
    return {
      baseSeed: 42, numTrials: 1000, startYear: 2025,
      seasonDefinition: { ...DEFAULT_SEASON_DEFINITION },
      years: Array.from({ length: 10 }, (_, i) => defaultYearParams(i + 1)),
      momentum: { ...DEFAULT_MOMENTUM },
    };
  }
  const c = raw as Record<string, unknown>;
  const years: YearParams[] = Array.isArray(c['years'])
    ? (c['years'] as unknown[]).map((y, i) => migrateYearParams(y, i + 1))
    : Array.from({ length: 10 }, (_, i) => defaultYearParams(i + 1));

  return {
    id: typeof c['id'] === 'string' ? c['id'] : undefined,
    name: typeof c['name'] === 'string' ? c['name'] : undefined,
    baseSeed: typeof c['baseSeed'] === 'number' ? c['baseSeed'] : 42,
    numTrials: typeof c['numTrials'] === 'number' ? c['numTrials'] : 1000,
    startYear: typeof c['startYear'] === 'number' ? c['startYear'] : 2025,
    seasonDefinition: (c['seasonDefinition'] as SimulationConfig['seasonDefinition']) ?? {
      ...DEFAULT_SEASON_DEFINITION,
    },
    years,
    momentum: migrateMomentum(c['momentum']),
  };
}
