/**
 * Mulberry32 seeded PRNG — fast, seedable 32-bit pseudo-random number generator.
 * Produces identical sequences for identical seeds across runs and environments.
 */
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0; // Force unsigned 32-bit integer
  }

  /** Returns a float in [0, 1) */
  next(): number {
    let z = (this.state += 0x6d2b79f5 | 0);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  /** Returns an integer in [0, max) */
  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /**
   * Returns a standard normal sample via Box-Muller transform.
   * Consumes two uniform samples.
   */
  nextNormal(): number {
    const u1 = this.next();
    const u2 = this.next();
    // Box-Muller: avoid log(0)
    const safe_u1 = u1 === 0 ? Number.EPSILON : u1;
    return Math.sqrt(-2 * Math.log(safe_u1)) * Math.cos(2 * Math.PI * u2);
  }

  /**
   * Returns a log-normal sample: exp(Normal(mu, sigma))
   */
  nextLogNormal(mu: number, sigma: number): number {
    return Math.exp(mu + sigma * this.nextNormal());
  }

  /** Clone the RNG at its current state */
  clone(): SeededRNG {
    const rng = new SeededRNG(0);
    rng.state = this.state;
    return rng;
  }
}
