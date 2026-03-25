import { TransitionMatrix, TRANSITION_DURATION_STEPS } from '@/core/types';
import { stationaryDistribution } from '@/core/markov';
import TooltipHelp from '@/components/shared/TooltipHelp';

// Simple SVG sparkline for probability curve
function ProbSparkline({ values, color }: { values: number[]; color: string }) {
  const w = 220;
  const h = 32;
  const pad = 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 0.001;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
      const y = h - pad - ((v - min) / range) * (h - 2 * pad);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = pad + (i / (values.length - 1)) * (w - 2 * pad);
        const y = h - pad - ((v - min) / range) * (h - 2 * pad);
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={2} fill={color} />;
      })}
    </svg>
  );
}

interface ProbRowProps {
  label: string;
  values: number[];
  color: string;
  onChange: (values: number[]) => void;
}

function ProbabilityRow({ label, values, color, onChange }: ProbRowProps) {
  const update = (i: number, raw: string) => {
    const v = parseFloat(raw);
    if (!isFinite(v) || v <= 0 || v >= 1) return;
    const next = [...values];
    next[i] = v;
    onChange(next);
  };

  const applyPreset = (shape: 'flat' | 'decreasing' | 'increasing') => {
    const base = values[0] ?? 0.05;
    let next: number[];
    if (shape === 'flat') {
      next = Array(TRANSITION_DURATION_STEPS).fill(base) as number[];
    } else if (shape === 'decreasing') {
      const hi = base;
      const lo = Math.max(hi * 0.3, 0.001);
      next = Array.from({ length: TRANSITION_DURATION_STEPS }, (_, i) =>
        Math.max(hi - (hi - lo) * (i / (TRANSITION_DURATION_STEPS - 1)), 0.001)
      );
    } else {
      const lo = base;
      const hi = Math.min(lo * 3, 0.999);
      next = Array.from({ length: TRANSITION_DURATION_STEPS }, (_, i) =>
        Math.min(lo + (hi - lo) * (i / (TRANSITION_DURATION_STEPS - 1)), 0.999)
      );
    }
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color }}>{label}</span>
        <div className="flex gap-1">
          {(['flat', 'decreasing', 'increasing'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => applyPreset(s)}
              className="px-1.5 py-0.5 text-xs rounded border border-gray-200 text-gray-500 hover:bg-gray-50 capitalize"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <ProbSparkline values={values} color={color} />
      <div className="flex gap-1 overflow-x-auto pb-1">
        {values.map((v, i) => (
          <div key={i} className="flex flex-col items-center shrink-0" style={{ width: '44px' }}>
            <span className="text-xs text-gray-400 mb-0.5">{i < 9 ? `D${i + 1}` : 'D10+'}</span>
            <input
              type="number"
              step="0.005"
              min="0.001"
              max="0.999"
              className="w-full text-center text-xs border border-gray-200 rounded px-0.5 py-0.5 focus:outline-none focus:border-blue-400"
              value={v.toFixed(3)}
              onChange={(e) => update(i, e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface SeasonMatrixProps {
  label: string;
  value: TransitionMatrix;
  onChange: (m: TransitionMatrix) => void;
}

function SeasonMatrix({ label, value, onChange }: SeasonMatrixProps) {
  let pHigh = 0;
  try {
    [, pHigh] = stationaryDistribution(value);
  } catch {
    /* skip */
  }
  const pHN = value.pHighToNormal[0] ?? 0.3;
  const avgRunHigh = pHN > 0 ? (1 / pHN).toFixed(1) : '∞';

  return (
    <div className="space-y-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-gray-600">{label}</span>
        <span className="text-xs text-gray-400">
          ≈{(pHigh * 100).toFixed(1)}% high · avg high run {avgRunHigh}d
          <TooltipHelp text="Stationary % high days and average consecutive high-day run length, computed from Day-1 probabilities." />
        </span>
      </div>
      <ProbabilityRow
        label="P(Normal → High) by consecutive normal days"
        values={value.pNormalToHigh}
        color="#ea580c"
        onChange={(v) => onChange({ ...value, pNormalToHigh: v })}
      />
      <ProbabilityRow
        label="P(High → Normal) by consecutive high days"
        values={value.pHighToNormal}
        color="#2563eb"
        onChange={(v) => onChange({ ...value, pHighToNormal: v })}
      />
    </div>
  );
}

interface Props {
  summer: TransitionMatrix;
  other: TransitionMatrix;
  onChange: (summer: TransitionMatrix, other: TransitionMatrix) => void;
}

export default function MarkovInputs({ summer, other, onChange }: Props) {
  return (
    <div className="space-y-4">
      <div className="text-xs text-gray-500 bg-blue-50 rounded p-2 border border-blue-100">
        <strong>Duration-dependent transitions:</strong> Each cell sets the transition probability given N consecutive days in the current regime. Day 10+ uses the last value.
      </div>
      <SeasonMatrix
        label="Summer Season"
        value={summer}
        onChange={(m) => onChange(m, other)}
      />
      <SeasonMatrix
        label="Other Season"
        value={other}
        onChange={(m) => onChange(summer, m)}
      />
    </div>
  );
}
