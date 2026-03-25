import { SimulationConfig } from '@/core/types';
import TooltipHelp from '@/components/shared/TooltipHelp';

interface Props {
  config: SimulationConfig;
  onChange: (c: SimulationConfig) => void;
}

export default function SimSettings({ config, onChange }: Props) {
  const set = <K extends keyof SimulationConfig>(key: K, value: SimulationConfig[K]) =>
    onChange({ ...config, [key]: value });

  return (
    <div className="space-y-3">
      <div>
        <label className="label">
          Random Seed
          <TooltipHelp text="Integer 0–4294967295. Same seed + inputs always produces identical results." />
        </label>
        <input
          type="number"
          className="input-field"
          value={config.baseSeed}
          min={0}
          max={4294967295}
          onChange={(e) => set('baseSeed', Math.max(0, parseInt(e.target.value, 10) || 0))}
        />
      </div>

      <div>
        <label className="label">
          Number of Trials
          <TooltipHelp text="Monte Carlo trials (100–10,000). More trials = more accurate percentiles but slower." />
        </label>
        <input
          type="number"
          className="input-field"
          value={config.numTrials}
          min={100}
          max={10000}
          step={100}
          onChange={(e) => set('numTrials', parseInt(e.target.value, 10) || 100)}
        />
      </div>

      <div>
        <label className="label">
          Start Calendar Year
          <TooltipHelp text="Calendar label for Year 1 (display only). Affects x-axis labels." />
        </label>
        <input
          type="number"
          className="input-field"
          value={config.startYear}
          min={2020}
          max={2060}
          onChange={(e) => set('startYear', parseInt(e.target.value, 10) || 2025)}
        />
      </div>
    </div>
  );
}
