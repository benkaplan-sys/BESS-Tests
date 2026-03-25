import { useState, useRef, useCallback } from 'react';
import { SimulationConfig, SimulationResult, SimulationProgress } from '@/core/types';
import SimWorker from '@/workers/simulation.worker?worker';

interface WorkerMessage {
  type: 'PROGRESS' | 'COMPLETE' | 'ERROR';
  completed?: number;
  total?: number;
  result?: SimulationResult;
  error?: string;
}

export function useSimulation() {
  const [progress, setProgress] = useState<SimulationProgress>({
    completedTrials: 0,
    totalTrials: 0,
    status: 'idle',
  });
  const workerRef = useRef<Worker | null>(null);

  const run = useCallback(
    (config: SimulationConfig): Promise<SimulationResult | null> => {
      return new Promise((resolve) => {
        // Terminate any existing worker
        if (workerRef.current) {
          workerRef.current.terminate();
        }

        const worker = new SimWorker();
        workerRef.current = worker;

        setProgress({ completedTrials: 0, totalTrials: config.numTrials, status: 'running' });

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          const { type } = event.data;

          if (type === 'PROGRESS') {
            setProgress((p) => ({
              ...p,
              completedTrials: event.data.completed ?? p.completedTrials,
            }));
          } else if (type === 'COMPLETE') {
            setProgress((p) => ({
              ...p,
              completedTrials: p.totalTrials,
              status: 'complete',
            }));
            worker.terminate();
            workerRef.current = null;
            resolve(event.data.result ?? null);
          } else if (type === 'ERROR') {
            console.error('Simulation error:', event.data.error);
            setProgress((p) => ({ ...p, status: 'error', error: event.data.error }));
            worker.terminate();
            workerRef.current = null;
            resolve(null);
          }
        };

        worker.onerror = (e: ErrorEvent) => {
          console.error('Worker error:', e);
          setProgress((p) => ({ ...p, status: 'error', error: 'Worker crashed' }));
          worker.terminate();
          workerRef.current = null;
          resolve(null);
        };

        worker.postMessage({ type: 'RUN', config });
      });
    },
    []
  );

  return {
    run,
    progress,
    isRunning: progress.status === 'running',
  };
}
