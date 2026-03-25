import {
  SimulationConfig, ValidationIssue, LogNormalParams,
  TransitionMatrix, MomentumConfig, TRANSITION_DURATION_STEPS,
} from './types';
import { logNormalToReal } from './distributions';

function err(field: string, message: string): ValidationIssue {
  return { field, severity: 'error', message };
}

function warn(field: string, message: string): ValidationIssue {
  return { field, severity: 'warning', message };
}

function validateLogNormal(params: LogNormalParams, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isFinite(params.mu)) issues.push(err(`${prefix}.mu`, 'Must be a finite number'));
  if (!isFinite(params.sigma) || params.sigma <= 0) {
    issues.push(err(`${prefix}.sigma`, 'Must be a positive finite number'));
  }
  return issues;
}

function validateTransitionMatrix(matrix: TransitionMatrix, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const validateProbs = (probs: number[], field: string) => {
    if (!Array.isArray(probs) || probs.length !== TRANSITION_DURATION_STEPS) {
      issues.push(err(field, `Must have exactly ${TRANSITION_DURATION_STEPS} probability values (days 1-10)`));
      return;
    }
    probs.forEach((p, i) => {
      if (!isFinite(p) || p <= 0 || p >= 1) {
        issues.push(err(`${field}[${i}]`, `Day ${i + 1}: must be strictly between 0 and 1`));
      }
    });
  };

  validateProbs(matrix.pNormalToHigh, `${prefix}.pNormalToHigh`);
  validateProbs(matrix.pHighToNormal, `${prefix}.pHighToNormal`);
  return issues;
}

function validateMomentum(momentum: MomentumConfig, prefix: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isFinite(momentum.pathWeight) || momentum.pathWeight < 0 || momentum.pathWeight > 1) {
    issues.push(err(`${prefix}.pathWeight`, 'Path weight must be between 0 and 1'));
  }
  return issues;
}

export function validateConfig(config: SimulationConfig): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Number.isInteger(config.baseSeed) || config.baseSeed < 0 || config.baseSeed > 4294967295) {
    issues.push(err('baseSeed', 'Must be an integer between 0 and 2^32 - 1'));
  }

  if (!Number.isInteger(config.numTrials) || config.numTrials < 100 || config.numTrials > 10000) {
    issues.push(err('numTrials', 'Must be an integer between 100 and 10,000'));
  }

  if (!Number.isInteger(config.startYear) || config.startYear < 2020 || config.startYear > 2060) {
    issues.push(err('startYear', 'Must be an integer between 2020 and 2060'));
  }

  const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const hasSummer = allMonths.some((m) => config.seasonDefinition[m] === 'summer');
  const hasOther = allMonths.some((m) => config.seasonDefinition[m] === 'other');
  for (const m of allMonths) {
    const season = config.seasonDefinition[m];
    if (season !== 'summer' && season !== 'other') {
      issues.push(err(`seasonDefinition[${m}]`, `Month ${m} must be "summer" or "other"`));
    }
  }
  if (!hasSummer) issues.push(err('seasonDefinition', 'At least one month must be "summer"'));
  if (!hasOther) issues.push(err('seasonDefinition', 'At least one month must be "other"'));

  if (!Array.isArray(config.years) || config.years.length !== 10) {
    issues.push(err('years', 'Must have exactly 10 year entries'));
  } else {
    for (let i = 0; i < 10; i++) {
      const y = config.years[i]!;
      const prefix = `years[${i}]`;
      if (y.year !== i + 1) {
        issues.push(err(`${prefix}.year`, `Expected year ${i + 1}, got ${y.year}`));
      }
      issues.push(...validateLogNormal(y.normal, `${prefix}.normal`));
      issues.push(...validateLogNormal(y.high, `${prefix}.high`));
      issues.push(...validateTransitionMatrix(y.summer, `${prefix}.summer`));
      issues.push(...validateTransitionMatrix(y.other, `${prefix}.other`));

      try {
        const normalReal = logNormalToReal(y.normal);
        const highReal = logNormalToReal(y.high);
        if (highReal.mean <= normalReal.mean) {
          issues.push(warn(`${prefix}`, 'High-day mean revenue \u2264 normal-day mean \u2014 verify this is intentional'));
        }
      } catch {
        // Skip warning if params are invalid (already reported above)
      }
    }
  }

  issues.push(...validateMomentum(config.momentum, 'momentum'));

  return issues;
}
