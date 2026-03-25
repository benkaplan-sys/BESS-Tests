import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { SimulationConfig, AnnualResult } from '@/core/types';
import { useLivePreview } from '@/hooks/useLivePreview';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

const fmt = (v: number) => `$${(v / 1000).toFixed(0)}k`;

interface MiniFanProps {
  data: {
    year: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
  }[];
  color: string;
  title: string;
}

function MiniFanChart({ data, color, title }: MiniFanProps) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-600 mb-1 text-center">{title}</div>
      <ResponsiveContainer width="100%" height={150}>
        <AreaChart data={data} margin={{ top: 5, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 9 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 9 }} width={36} />
          <Tooltip
            formatter={(v: number) => [fmt(v), '']}
            labelFormatter={(l: number) => `Year ${l}`}
            contentStyle={{ fontSize: '10px', padding: '4px 8px' }}
          />
          {/* Outer band P10-P90 */}
          <Area type="monotone" dataKey="p90" stroke="none" fill={color} fillOpacity={0.12} dot={false} />
          <Area type="monotone" dataKey="p75" stroke="none" fill={color} fillOpacity={0.15} dot={false} />
          <Area type="monotone" dataKey="p25" stroke="none" fill="white" fillOpacity={1} dot={false} />
          <Area type="monotone" dataKey="p10" stroke="none" fill="white" fillOpacity={1} dot={false} />
          {/* Median */}
          <Area type="monotone" dataKey="p50" stroke={color} strokeWidth={2} fill="none" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function makeChartData(
  results: AnnualResult[],
  startYear: number,
  getter: (r: AnnualResult) => { p10: number; p25: number; p50: number; p75: number; p90: number }
) {
  return results.map((r) => ({
    year: startYear + r.year - 1,
    ...getter(r),
  }));
}

interface Props {
  config: SimulationConfig;
}

export default function LivePreviewPanel({ config }: Props) {
  const [enabled, setEnabled] = useState(false);
  const { result, isComputing } = useLivePreview(config, enabled);

  const combinedData = result
    ? makeChartData(result.annualResults, config.startYear, (r) => ({
        p10: r.p10, p25: r.p25, p50: r.p50, p75: r.p75, p90: r.p90,
      }))
    : [];

  const normalData = result
    ? makeChartData(result.annualResults, config.startYear, (r) => ({
        p10: r.normalStats.p10, p25: r.normalStats.p25, p50: r.normalStats.p50,
        p75: r.normalStats.p75, p90: r.normalStats.p90,
      }))
    : [];

  const highData = result
    ? makeChartData(result.annualResults, config.startYear, (r) => ({
        p10: r.highStats.p10, p25: r.highStats.p25, p50: r.highStats.p50,
        p75: r.highStats.p75, p90: r.highStats.p90,
      }))
    : [];

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-800">Live Preview</h3>
          <span className="text-xs text-gray-400">200 trials · updates 0.6s after changes</span>
        </div>
        <div className="flex items-center gap-2">
          {isComputing && <LoadingSpinner size="sm" />}
          <span className="text-xs text-gray-500">{enabled ? 'On' : 'Off'}</span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((e) => !e)}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              enabled ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {!enabled && (
        <div className="flex items-center justify-center h-20 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg">
          Toggle on to see charts update live as you adjust parameters
        </div>
      )}

      {enabled && !result && !isComputing && (
        <div className="flex items-center justify-center h-20 text-xs text-gray-400">
          Waiting for input to settle…
        </div>
      )}

      {enabled && isComputing && !result && (
        <div className="flex items-center justify-center gap-2 h-20 text-xs text-gray-500">
          <LoadingSpinner size="sm" /> Computing preview…
        </div>
      )}

      {enabled && result && (
        <div className="relative">
          {isComputing && (
            <div className="absolute top-0 right-0 z-10 flex items-center gap-1 text-xs text-blue-500 bg-white/80 rounded px-1">
              <LoadingSpinner size="sm" /> Updating…
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            <MiniFanChart data={combinedData} color="#2563eb" title="Combined Revenue" />
            <MiniFanChart data={normalData} color="#16a34a" title="Normal-Day Revenue" />
            <MiniFanChart data={highData} color="#ea580c" title="High-Day Revenue" />
          </div>
          <div className="text-center mt-1 text-xs text-gray-400">
            Bands: P10–P25–P50–P75–P90 · 200 trials preview
          </div>
        </div>
      )}
    </div>
  );
}
