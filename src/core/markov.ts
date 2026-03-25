import { Regime, Season, SeasonDefinition, TransitionMatrix, TRANSITION_DURATION_STEPS } from './types';
import { SeededRNG } from './rng';

/**
 * Get the transition probability for the given number of consecutive days in the current regime.
 * The last entry (index 9) applies to day 10 and all subsequent days.
 * Safe accessor: bounds-clamps idx and uses non-null assertion (length is always TRANSITION_DURATION_STEPS).
 */
export function getTransitionProb(probs: number[], consecutiveDays: number): number {
  const idx = Math.min(Math.max(consecutiveDays - 1, 0), TRANSITION_DURATION_STEPS - 1);
  // idx is guaranteed [0, 9]; probs has TRANSITION_DURATION_STEPS elements
  return probs[idx]!;
}

/**
 * Compute the stationary distribution [p_normal, p_high] of the Markov chain
 * using the day-1 transition probabilities as the effective scalars.
 * (For duration-dependent chains, this is an approximation.)
 */
export function stationaryDistribution(matrix: TransitionMatrix): [number, number] {
  const pNH = matrix.pNormalToHigh[0]!;
  const pHN = matrix.pHighToNormal[0]!;
  const denom = pNH + pHN;
  if (denom === 0) return [1, 0];
  return [pHN / denom, pNH / denom];
}

/**
 * Sample the next regime given the current regime, how many consecutive days
 * we've been in it, and the transition matrix.
 */
export function sampleNextRegime(
  currentRegime: Regime,
  consecutiveDays: number,
  matrix: TransitionMatrix,
  rng: SeededRNG
): Regime {
  const u = rng.next();
  if (currentRegime === 'normal') {
    return u < getTransitionProb(matrix.pNormalToHigh, consecutiveDays) ? 'high' : 'normal';
  } else {
    return u < getTransitionProb(matrix.pHighToNormal, consecutiveDays) ? 'normal' : 'high';
  }
}

/**
 * Fixed 365-day calendar (no leap years). Feb = 28 days.
 * Returns the month number (1-12) for a 1-indexed day of year (1-365).
 */
export function dayOfYearToMonth(day: number): number {
  if (day < 1 || day > 365) throw new Error(`Day ${day} out of range [1, 365]`);
  const monthEnds = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];
  for (let m = 0; m < monthEnds.length; m++) {
    const end = monthEnds[m]!;
    if (day <= end) return m + 1;
  }
  return 12;
}

/**
 * Resolve the season for a given 1-indexed day of year using the user-defined mapping.
 */
export function getSeasonForDay(day: number, seasonDef: SeasonDefinition): Season {
  const month = dayOfYearToMonth(day);
  const season = seasonDef[month];
  if (season === undefined) throw new Error(`Month ${month} not in season definition`);
  return season;
}

/**
 * Sample an initial regime from the stationary distribution.
 */
export function sampleInitialRegime(matrix: TransitionMatrix, rng: SeededRNG): Regime {
  const [, pHigh] = stationaryDistribution(matrix);
  return rng.next() < pHigh ? 'high' : 'normal';
}
