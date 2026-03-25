import { MomentumConfig } from '@/core/types';
import TooltipHelp from '@/components/shared/TooltipHelp';

interface Props {
  value: MomentumConfig;
  onChange: (m: MomentumConfig) => void;
}

function intensityLabel(pathWeight: number): string {
  if (pathWeight < 0.05) return 'Minimal';
  if (pathWeight < 0.15) return 'Moderate';
  if (pathWeight < 0.28) return 'Strong';
  return 'Very Strong';
}

export default function MomentumInput({ value, onChange }: Props) {
  const { pathWeight } = value;
  const label = intensityLabel(pathWeight);

  return (
    <div className="space-y-3">
      {/* Toggle row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-gray-700">Path-Dependent Momentum</span>
          <TooltipHelp text="At the end of each year, a trial's realized log-revenue deviation from the stationary baseline is accumulated permanently into a drift applied to all future years. Trials that run high stay high; trials that run low stay low — with no reversion to the mean." />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={value.enabled}
          onClick={() => onChange({ ...value, enabled: !value.enabled })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
            value.enabled ? 'bg-blue-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
              value.enabled ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {value.enabled && (
        <div className="space-y-4 pl-1 border-l-2 border-blue-200">
          {/* pathWeight slider */}
          <div>
            <label className="label flex items-center gap-1">
              Drift Scale
              <TooltipHelp text="How much of each year's log-revenue deviation compounds into future years. Higher = faster fan widening and stronger path separation. 0.10–0.25 is recommended for realistic long-run divergence." />
            </label>
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={pathWeight}
                  onChange={(e) => onChange({ ...value, pathWeight: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5 px-0.5">
                  <span>None (0)</span>
                  <span>Full (1.0)</span>
                </div>
              </div>
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                className="input-field w-20 text-sm text-center"
                value={pathWeight.toFixed(2)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (isFinite(v) && v >= 0 && v <= 1) onChange({ ...value, pathWeight: v });
                }}
              />
            </div>
          </div>

          {/* Info panel */}
          <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5 space-y-2">
            <div className="text-xs font-semibold text-blue-800 flex items-center justify-between">
              <span>Path Persistence — {label}</span>
              <span className="font-normal text-blue-600">scale = {pathWeight.toFixed(2)}</span>
            </div>
            <div className="text-xs text-gray-600 space-y-1">
              <p>
                Each year's log-revenue deviation from the baseline is multiplied by{' '}
                <span className="font-mono">{pathWeight.toFixed(2)}</span> and added permanently
                to future years' mu. A trial that earns 10% above baseline in year 1 carries a{' '}
                <span className="font-mono">+{(pathWeight * 0.095).toFixed(3)}</span> log-unit
                shift into year 2 — and it compounds from there.
              </p>
              <p className="text-gray-500">
                No mean reversion. Use the Live Preview to visualise the diverging fan.
                Recommended starting point: 0.20.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
