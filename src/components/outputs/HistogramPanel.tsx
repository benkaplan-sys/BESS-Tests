import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AnnualResult } from '@/core/types';

interface Props {
  results: AnnualResult[];
  startYear: number;
}

export default function HistogramPanel({ results, startYear }: Props) {
  const [selectedYear, setSelectedYear] = useState(0);
  const result = results[selectedYear];
  if (!result) return null;

  const data = result.histogramBins.map((b) => ({
    bin: `$${(b.binStart / 1000).toFixed(0)}k`,
    freq: parseFloat((b.frequency * 100).toFixed(2)),
    count: b.count,
  }));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <label className="text-sm font-medium text-gray-700">Year:</label>
        <div className="flex gap-1 flex-wrap">
          {results.map((r, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedYear(i)}
              className={`px-2 py-0.5 rounded text-xs font-medium border transition-colors ${
                selectedYear === i
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Y{r.year} ({startYear + r.year - 1})
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500 mb-3">
        Distribution of annual revenues across {result.histogramBins.reduce((s, b) => s + b.count, 0).toLocaleString()} trials.
        P50 = ${(result.p50 / 1000).toFixed(1)}k | Mean = ${(result.mean / 1000).toFixed(1)}k
      </p>

      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="bin"
            tick={{ fontSize: 10 }}
            angle={-45}
            textAnchor="end"
            height={50}
          />
          <YAxis unit="%" tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(v: number, _name: string, props: { payload?: { count?: number } }) => [
              `${v.toFixed(2)}% (${props.payload?.count ?? 0} trials)`,
              'Frequency',
            ]}
          />
          <Bar dataKey="freq" fill="#3b82f6" name="Frequency" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
