import { useState, useEffect, useCallback } from 'react';
import { listConfigs, saveConfig, deleteConfig, ConfigSummary } from '@/store/configStore';
import { SimulationConfig } from '@/core/types';

export function useConfigs() {
  const [configs, setConfigs] = useState<ConfigSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await listConfigs();
      setConfigs(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load configs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (config: SimulationConfig, name: string, description?: string): Promise<string> => {
      const id = await saveConfig(config, name, description);
      await refresh();
      return id;
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      await deleteConfig(id);
      await refresh();
    },
    [refresh]
  );

  return { configs, loading, error, refresh, save, remove };
}
