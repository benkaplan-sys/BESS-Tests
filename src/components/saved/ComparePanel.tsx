import { useState } from 'react';
import { useConfigs } from '@/hooks/useConfigs';
import { getConfigById } from '@/store/configStore';
import { getResultByConfigId } from '@/store/resultStore';
import { SimulationResult } from '@/core/types';
import AnnualSummaryTable from '@/components/outputs/AnnualSummaryTable';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface LoadedConfig {
  name: string;
  startYear: number;
  result: SimulationResult;
}

export default function ComparePanel() {
  const { configs } = useConfigs();
  const [left, setLeft] = useState<LoadedConfig | null>(null);
  const [right, setRight] = useState<LoadedConfig | null>(null);
  const [loading, setLoading] = useState<'left' | 'right' | null>(null);

  const loadConfig = async (id: string, side: 'left' | 'right') => {
    setLoading(side);
    try {
      const saved = await getConfigById(id);
      const savedResult = saved ? await getResultByConfigId(id) : null;
      if (saved && savedResult) {
        const loaded: LoadedConfig = {
          name: saved.name,
          startYear: saved.config.startYear,
          result: savedResult.result,
        };
        if (side === 'left') setLeft(loaded);
        else setRight(loaded);
      } else {
        alert('No saved results found for this configuration. Run the simulation and save it first.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Compare Configurations</h2>

      <div className="grid grid-cols-2 gap-4">
        {(['left', 'right'] as const).map((side) => {
          const loaded = side === 'left' ? left : right;
          return (
            <div key={side} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-gray-500 uppercase">{side === 'left' ? 'Config A' : 'Config B'}</span>
                {loaded && <span className="text-sm font-medium text-gray-800">{loaded.name}</span>}
              </div>
              <select
                className="input-field text-sm mb-3"
                defaultValue=""
                onChange={(e) => { if (e.target.value) void loadConfig(e.target.value, side); }}
              >
                <option value="" disabled>Select a configuration...</option>
                {configs.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.startYear})</option>
                ))}
              </select>
              {loading === side && <LoadingSpinner size="sm" />}
              {loaded && (
                <div className="text-xs text-gray-500">
                  P50 Y1: ${((loaded.result.annualResults[0]?.p50 ?? 0) / 1000).toFixed(1)}k →
                  Y10: ${((loaded.result.annualResults[9]?.p50 ?? 0) / 1000).toFixed(1)}k
                </div>
              )}
            </div>
          );
        })}
      </div>

      {left && right && (
        <div className="grid grid-cols-2 gap-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{left.name}</h3>
            <AnnualSummaryTable results={left.result.annualResults} startYear={left.startYear} />
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">{right.name}</h3>
            <AnnualSummaryTable results={right.result.annualResults} startYear={right.startYear} />
          </div>
        </div>
      )}
    </div>
  );
}
