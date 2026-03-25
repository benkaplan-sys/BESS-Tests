import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AnnualResult } from '@/core/types';

interface Props {
  results: AnnualResult[];
  startYear: number;
}

const fmt = (v: number) => `$${(v / 1000).toFixed(0)}k`;

export default function FanChart({ results, startYear }: Props) {
  const data = results.map((r) => ({
    year: startYear + r.year - 1,
    p10: r.p10,
    p25: r.p25,
    p50: r.p50,
    p75: r.p75,
    p90: r.p90,
    mean: r.mean,
    // recharts area stacking: use differences
    p10_val: r.p10,
    p10_to_p25: r.p25 - r.p10,
    p25_to_p75: r.p75 - r.p25,
    p75_to_p90: r.p90 - r.p75,
  }));

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Annual revenue percentiles across {results[0] ? '' : ''}all simulation trials.
        Shaded bands show P10–P90 range; center line is P50 (median).
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
          <defs>
            <linearGradient id="p10p90" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#93c5fd" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={fmt} tick={{ fontSize: 12 }} width={60} />
          <Tooltip
            formatter={(value: number, name: string) => {
              const labels: Record<string, string> = {
                p90: 'P90', p75: 'P75', p50: 'P50 (Median)', p25: 'P25', p10: 'P10', mean: 'Mean',
              };
              return [fmt(value), labels[name] ?? name];
            }}
            labelFormatter={(label) => `Year: ${label}`}
          />
          <Legend
            formatter={(value) => {
              const labels: Record<string, string> = {
                p90: 'P90', p75: 'P75', p50: 'P50', p25: 'P25', p10: 'P10', mean: 'Mean',
              };
              return labels[value] ?? value;
            }}
          />
          {/* Fan areas */}
          <Area type="monotone" dataKey="p90" stroke="#93c5fd" strokeWidth={1} fill="#dbeafe" fillOpacity={0.5} dot={false} />
          <Area type="monotone" dataKey="p75" stroke="#60a5fa" strokeWidth={1} fill="#bfdbfe" fillOpacity={0.5} dot={false} />
          <Area type="monotone" dataKey="p25" stroke="#60a5fa" strokeWidth={1} fill="#bfdbfe" fillOpacity={0.5} dot={false} />
          <Area type="monotone" dataKey="p10" stroke="#93c5fd" strokeWidth={1} fill="white" fillOpacity={1} dot={false} />
          {/* Median line */}
          <Area type="monotone" dataKey="p50" stroke="#2563eb" strokeWidth={2.5} fill="none" dot={{ r: 3, fill: '#2563eb' }} />
          {/* Mean line */}
          <Area type="monotone" dataKey="mean" stroke="#16a34a" strokeWidth={1.5} strokeDasharray="4 2" fill="none" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-blue-600 inline-block" /> P50 (Median)</span>
        <span className="flex items-center gap-1"><span className="w-6 h-0.5 bg-green-600 inline-block border-dashed border" /> Mean</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 bg-blue-100 inline-block border border-blue-300" /> P25–P75</span>
        <span className="flex items-center gap-1"><span className="w-4 h-3 bg-blue-50 inline-block border border-blue-200" /> P10–P90</span>
      </div>
    </div>
  );
}
