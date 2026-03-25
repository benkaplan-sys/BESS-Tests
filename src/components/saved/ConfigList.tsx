import { useState } from 'react';
import { useConfigs } from '@/hooks/useConfigs';
import { getConfigById } from '@/store/configStore';
import { SimulationConfig } from '@/core/types';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface Props {
  onLoad: (config: SimulationConfig) => void;
}

export default function ConfigList({ onLoad }: Props) {
  const { configs, loading, error, remove } = useConfigs();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleLoad = async (id: string) => {
    setLoadingId(id);
    try {
      const saved = await getConfigById(id);
      if (saved) onLoad(saved.config);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    setConfirmDelete(null);
  };

  const handleExport = async (id: string, name: string) => {
    const saved = await getConfigById(id);
    if (!saved) return;
    const json = JSON.stringify(saved, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bess-config-${name.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 text-sm p-4">
        Error loading configurations: {error}
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <svg className="mx-auto h-12 w-12 mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
        <p className="text-sm font-medium">No saved configurations</p>
        <p className="text-xs mt-1">Run a simulation and click "Save" to store it here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Saved Configurations</h2>
        <span className="text-xs text-gray-500">{configs.length} saved</span>
      </div>
      <div className="grid gap-3">
        {configs.map((c) => (
          <div key={c.id} className="card p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-gray-800 truncate">{c.name}</div>
              {c.description && (
                <div className="text-xs text-gray-600 mt-0.5 truncate">{c.description}</div>
              )}
              <div className="text-xs text-gray-500 mt-0.5">
                {c.numTrials.toLocaleString()} trials · Start {c.startYear} ·
                Saved {new Date(c.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                className="btn-primary py-1 text-xs"
                onClick={() => void handleLoad(c.id)}
                disabled={loadingId === c.id}
              >
                {loadingId === c.id ? <LoadingSpinner size="sm" /> : 'Load'}
              </button>
              <button
                className="btn-secondary py-1 text-xs"
                onClick={() => void handleExport(c.id, c.name)}
              >
                Export
              </button>
              {confirmDelete === c.id ? (
                <>
                  <button className="btn-danger py-1 text-xs" onClick={() => void handleDelete(c.id)}>
                    Confirm
                  </button>
                  <button className="btn-secondary py-1 text-xs" onClick={() => setConfirmDelete(null)}>
                    Cancel
                  </button>
                </>
              ) : (
                <button className="btn-secondary py-1 text-xs text-red-600 hover:bg-red-50" onClick={() => setConfirmDelete(c.id)}>
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
