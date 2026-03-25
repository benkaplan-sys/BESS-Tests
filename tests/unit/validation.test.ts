import { describe, it, expect } from 'vitest';
import { validateConfig } from '@/core/validation';
import { CANONICAL_CONFIG } from '../fixtures/validInputs';
import { flatProbs } from '@/core/types';

describe('validateConfig', () => {
  it('returns no errors for valid canonical config', () => {
    const errors = validateConfig(CANONICAL_CONFIG).filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('errors on invalid baseSeed', () => {
    const issues = validateConfig({ ...CANONICAL_CONFIG, baseSeed: -1 });
    expect(issues.some((i) => i.field === 'baseSeed' && i.severity === 'error')).toBe(true);
  });

  it('errors on numTrials < 100', () => {
    const issues = validateConfig({ ...CANONICAL_CONFIG, numTrials: 50 });
    expect(issues.some((i) => i.field === 'numTrials' && i.severity === 'error')).toBe(true);
  });

  it('errors on numTrials > 10000', () => {
    const issues = validateConfig({ ...CANONICAL_CONFIG, numTrials: 20000 });
    expect(issues.some((i) => i.field === 'numTrials' && i.severity === 'error')).toBe(true);
  });

  it('errors on startYear out of range', () => {
    const issues = validateConfig({ ...CANONICAL_CONFIG, startYear: 2010 });
    expect(issues.some((i) => i.field === 'startYear' && i.severity === 'error')).toBe(true);
  });

  it('errors when pNormalToHigh contains invalid value', () => {
    const config = {
      ...CANONICAL_CONFIG,
      years: CANONICAL_CONFIG.years.map((y, i) =>
        i === 0 ? { ...y, summer: { ...y.summer, pNormalToHigh: flatProbs(0) } } : y
      ),
    };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.field.includes('pNormalToHigh') && i.severity === 'error')).toBe(true);
  });

  it('errors when pNormalToHigh array has wrong length', () => {
    const config = {
      ...CANONICAL_CONFIG,
      years: CANONICAL_CONFIG.years.map((y, i) =>
        i === 0 ? { ...y, summer: { ...y.summer, pNormalToHigh: [0.05, 0.05] } } : y
      ),
    };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.field.includes('pNormalToHigh') && i.severity === 'error')).toBe(true);
  });

  it('errors when sigma = 0', () => {
    const config = {
      ...CANONICAL_CONFIG,
      years: CANONICAL_CONFIG.years.map((y, i) =>
        i === 0 ? { ...y, normal: { ...y.normal, sigma: 0 } } : y
      ),
    };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.field.includes('sigma') && i.severity === 'error')).toBe(true);
  });

  it('warns when high mean <= normal mean', () => {
    const config = {
      ...CANONICAL_CONFIG,
      years: CANONICAL_CONFIG.years.map((y, i) =>
        i === 0 ? { ...y, high: { mu: 9.0, sigma: 0.4 } } : y
      ),
    };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.severity === 'warning')).toBe(true);
  });

  it('errors on pathWeight out of range (> 1)', () => {
    const config = { ...CANONICAL_CONFIG, momentum: { enabled: true, pathWeight: 1.5 } };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.field === 'momentum.pathWeight' && i.severity === 'error')).toBe(true);
  });

  it('errors on negative pathWeight', () => {
    const config = { ...CANONICAL_CONFIG, momentum: { enabled: false, pathWeight: -0.1 } };
    const issues = validateConfig(config);
    expect(issues.some((i) => i.field === 'momentum.pathWeight' && i.severity === 'error')).toBe(true);
  });

  it('accepts valid pathWeight whether enabled or not', () => {
    const config = { ...CANONICAL_CONFIG, momentum: { enabled: true, pathWeight: 0.20 } };
    const errors = validateConfig(config).filter((i) => i.field.startsWith('momentum') && i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
