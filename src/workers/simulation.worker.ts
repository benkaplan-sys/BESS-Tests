import { SimulationConfig } from '@/core/types';
import { runSimulation, hashConfig } from '@/core/simulator';

interface WorkerMessage {
  type: 'RUN';
  config: SimulationConfig;
}

interface ProgressMessage {
  type: 'PROGRESS';
  completed: number;
  total: number;
}

interface CompleteMessage {
  type: 'COMPLETE';
  result: ReturnType<typeof runSimulation> & { configHash: string };
}

interface ErrorMessage {
  type: 'ERROR';
  error: string;
}

type OutgoingMessage = ProgressMessage | CompleteMessage | ErrorMessage;

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, config } = event.data;

  if (type !== 'RUN') return;

  try {
    const configHash = await hashConfig(config);

    const result = runSimulation(config, (completed) => {
      const msg: OutgoingMessage = {
        type: 'PROGRESS',
        completed,
        total: config.numTrials,
      };
      self.postMessage(msg);
    });

    const complete: OutgoingMessage = {
      type: 'COMPLETE',
      result: { ...result, configHash },
    };
    self.postMessage(complete);
  } catch (e) {
    const errMsg: OutgoingMessage = {
      type: 'ERROR',
      error: e instanceof Error ? e.message : String(e),
    };
    self.postMessage(errMsg);
  }
};
