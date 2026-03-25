import { LogNormalParams, RealSpaceParams } from './types';
import { SeededRNG } from './rng';

/**
 * Convert real-space arithmetic mean and standard deviation to
 * log-normal log-space parameters (mu, sigma).
 *
 * If X ~ LogNormal(mu, sigma), then:
 *   E[X] = exp(mu + sigma^2 / 2)
 *   Var[X] = (exp(sigma^2) - 1) * exp(2*mu + sigma^2)
 *
 * Solving for mu and sigma:
 *   sigma^2 = ln(1 + (std/mean)^2)
 *   mu = ln(mean) - sigma^2 / 2
 */
export function realToLogNormal(params: RealSpaceParams): LogNormalParams {
  if (params.mean <= 0) throw new Error('mean must be positive for log-normal conversion');
  if (params.std <= 0) throw new Error('std must be positive for log-normal conversion');
  const cv2 = (params.std / params.mean) ** 2; // coefficient of variation squared
  const sigma2 = Math.log(1 + cv2);
  const sigma = Math.sqrt(sigma2);
  const mu = Math.log(params.mean) - sigma2 / 2;
  return { mu, sigma };
}

/**
 * Convert log-space parameters (mu, sigma) to real-space arithmetic mean and std.
 */
export function logNormalToReal(params: LogNormalParams): RealSpaceParams {
  if (params.sigma <= 0) throw new Error('sigma must be positive');
  const sigma2 = params.sigma ** 2;
  const mean = Math.exp(params.mu + sigma2 / 2);
  const variance = (Math.exp(sigma2) - 1) * Math.exp(2 * params.mu + sigma2);
  const std = Math.sqrt(variance);
  return { mean, std };
}

/**
 * Sample from LogNormal(mu, sigma) using the provided seeded RNG.
 * Returns a positive number.
 */
export function sampleLogNormal(params: LogNormalParams, rng: SeededRNG): number {
  return rng.nextLogNormal(params.mu, params.sigma);
}
