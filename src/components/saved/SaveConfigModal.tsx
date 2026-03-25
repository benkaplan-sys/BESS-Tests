import { useState } from 'react';
import { SimulationConfig, SimulationResult } from '@/core/types';
import { useConfigs } from '@/hooks/useConfigs';
import { saveResult } from '@/store/resultStore';
import { hashConfig } from '@/core/simulator';

interface Props {
  config: SimulationConfig;
  result: SimulationResult;
  onClose: () => void;
}

export default function SaveConfigModal({ config, result, onClose }: Props) {
  const [name, setName] = useState(config.name ?? '');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { save } = useConfigs();

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Please enter a name for this scenario.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const configId = await save(config, name.trim(), description.trim() || undefined);
      const configHash = await hashConfig(config);
      await saveResult(configId, config, configHash, result);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Save Simulation Scenario</h2>

        <div className="space-y-4">
          <div>
            <label className="label">
              Scenario Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Base Case 2025, High Volatility, Downside"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); }}
            />
          </div>

          <div>
            <label className="label">
              Notes / Description{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              className="input-field resize-none"
              rows={3}
              placeholder="Describe key assumptions, purpose, or how this differs from other scenarios…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <div className="font-medium text-gray-700 mb-1">Simulation Summary</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              <span className="text-gray-500">Trials</span>
              <span>{config.numTrials.toLocaleString()}</span>
              <span className="text-gray-500">Seed</span>
              <span>{config.baseSeed}</span>
              <span className="text-gray-500">Start Year</span>
              <span>{config.startYear}</span>
              <span className="text-gray-500">P50 Year 1</span>
              <span>${((result.annualResults[0]?.p50 ?? 0) / 1000).toFixed(1)}k/yr</span>
              <span className="text-gray-500">P50 Year 10</span>
              <span>${((result.annualResults[9]?.p50 ?? 0) / 1000).toFixed(1)}k/yr</span>
              <span className="text-gray-500">Momentum</span>
              <span>
                {config.momentum.enabled
                  ? `On (scale=${config.momentum.pathWeight.toFixed(2)})`
                  : 'Off'}
              </span>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</div>
          )}
        </div>

        <div className="flex gap-3 justify-end mt-6">
          <button className="btn-secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => void handleSave()}
            disabled={saving || !name.trim()}
          >
            {saving ? 'Saving…' : 'Save Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}
