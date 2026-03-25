import { useState, useEffect, useRef } from 'react';
import { SimulationConfig, SimulationResult } from '@/core/types';
import { runSimulation } from '@/core/simulator';

const PREVIEW_TRIALS = 200;
const DEBOUNCE_MS = 600;

export function useLivePreview(config: SimulationConfig, enabled: boolean) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResult(null);
      setIsComputing(false);
      return;
    }

    setIsComputing(true);

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      try {
        const previewConfig: SimulationConfig = { ...config, numTrials: PREVIEW_TRIALS };
        const simResult = runSimulation(previewConfig);
        setResult({ ...simResult, configHash: 'preview' });
      } catch (e) {
        console.error('Live preview error:', e);
      } finally {
        setIsComputing(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [config, enabled]);

  return { result, isComputing };
}
