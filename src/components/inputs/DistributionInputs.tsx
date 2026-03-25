import { LogNormalParams, RealSpaceParams } from '@/core/types';
import { logNormalToReal, realToLogNormal } from '@/core/distributions';
import TooltipHelp from '@/components/shared/TooltipHelp';
import { useState } from 'react';

interface Props {
  label: string;
  value: LogNormalParams;
  onChange: (p: LogNormalParams) => void;
}

type InputMode = 'logspace' | 'realspace';

export default function DistributionInputs({ label, value, onChange }: Props) {
  const [mode, setMode] = useState<InputMode>('logspace');

  let realValue: RealSpaceParams | null = null;
  try {
    realValue = logNormalToReal(value);
  } catch {
    // invalid params
  }

  const handleRealChange = (field: keyof RealSpaceParams, raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num) || num <= 0) return;
    try {
      const current = realValue ?? { mean: 50000, std: 10000 };
      const updated = { ...current, [field]: num };
      const logParams = realToLogNormal(updated);
      onChange(logParams);
    } catch {
      // ignore conversion errors
    }
  };

  const colorClass = label.toLowerCase().includes('high')
    ? 'text-orange-700 bg-orange-50 border-orange-200'
    : 'text-blue-700 bg-blue-50 border-blue-200';

  return (
    <div className={`rounded-lg border p-3 ${colorClass}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
        <div className="flex gap-1">
          <button
            type="button"
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${mode === 'logspace' ? 'bg-white shadow border-gray-300 font-medium' : 'border-transparent opacity-60'}`}
            onClick={() => setMode('logspace')}
          >
            Log-space
          </button>
          <button
            type="button"
            className={`px-2 py-0.5 rounded text-xs border transition-colors ${mode === 'realspace' ? 'bg-white shadow border-gray-300 font-medium' : 'border-transparent opacity-60'}`}
            onClick={() => setMode('realspace')}
          >
            Real-space
          </button>
        </div>
      </div>

      {mode === 'logspace' ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium opacity-80 flex items-center">
              μ (log mean)
              <TooltipHelp text="Log-space mean. Controls the center of the log-normal distribution." />
            </label>
            <input
              type="number"
              step="0.1"
              className="input-field text-sm mt-0.5"
              value={value.mu}
              onChange={(e) => onChange({ ...value, mu: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="text-xs font-medium opacity-80 flex items-center">
              σ (log std)
              <TooltipHelp text="Log-space standard deviation. Must be > 0. Controls the spread." />
            </label>
            <input
              type="number"
              step="0.05"
              min="0.001"
              className="input-field text-sm mt-0.5"
              value={value.sigma}
              onChange={(e) => onChange({ ...value, sigma: parseFloat(e.target.value) || 0.1 })}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium opacity-80 flex items-center">
              Mean ($/day)
              <TooltipHelp text="Arithmetic mean daily revenue in dollars." />
            </label>
            <input
              type="number"
              step="1000"
              min="1"
              className="input-field text-sm mt-0.5"
              value={realValue ? Math.round(realValue.mean) : ''}
              onChange={(e) => handleRealChange('mean', e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium opacity-80 flex items-center">
              Std Dev ($/day)
              <TooltipHelp text="Arithmetic standard deviation of daily revenue in dollars." />
            </label>
            <input
              type="number"
              step="1000"
              min="1"
              className="input-field text-sm mt-0.5"
              value={realValue ? Math.round(realValue.std) : ''}
              onChange={(e) => handleRealChange('std', e.target.value)}
            />
          </div>
        </div>
      )}

      {realValue && (
        <div className="mt-2 text-xs opacity-70">
          E[X] ≈ ${Math.round(realValue.mean).toLocaleString()}/day &nbsp;|&nbsp;
          σ ≈ ${Math.round(realValue.std).toLocaleString()}/day &nbsp;|&nbsp;
          Annual E[X] ≈ ${Math.round(realValue.mean * 365 / 1000).toLocaleString()}k
        </div>
      )}
    </div>
  );
}
