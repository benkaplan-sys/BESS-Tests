import { useMemo } from 'react';
import { SimulationConfig, ValidationIssue } from '@/core/types';
import { validateConfig } from '@/core/validation';

export function useValidation(config: SimulationConfig): { issues: ValidationIssue[] } {
  const issues = useMemo(() => validateConfig(config), [config]);
  return { issues };
}
