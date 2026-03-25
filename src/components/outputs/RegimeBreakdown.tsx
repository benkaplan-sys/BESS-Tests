import {
  BarChart,
  Bar,
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

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function RegimeBreakdown({ results, startYear }: Props) {
  const data = results.map((r) => ({
    year: `${startYear + r.year - 1}`,
    normal: parseFloat(((1 - r.meanHighFraction) * 100).toFixed(1)),
    high: parseFloat((r.meanHighFraction * 100).toFixed(1)),
  }));

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Average fraction of days in each revenue regime per year (across all trials).
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="year" tick={{ fontSize: 12 }} />
          <YAxis unit="%" tick={{ fontSize: 12 }} domain={[0, 100]} />
          <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
          <Legend />
          <Bar dataKey="normal" name="Normal Days" stackId="a" fill="#60a5fa" />
          <Bar dataKey="high" name="High Days" stackId="a" fill="#f97316" />
        </BarChart>
      </ResponsiveContainer>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-3 py-2 text-gray-600">Year</th>
              <th className="text-right px-3 py-2 text-blue-600">Normal Days %</th>
              <th className="text-right px-3 py-2 text-orange-600">High Days %</th>
              <th className="text-right px-3 py-2 text-orange-600">Avg High Days / Year</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={r.year} className={`border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50'}`}>
                <td className="px-3 py-1.5 font-medium">Y{r.year} ({startYear + r.year - 1})</td>
                <td className="text-right px-3 py-1.5 text-blue-600">{pct(1 - r.meanHighFraction)}</td>
                <td className="text-right px-3 py-1.5 text-orange-600 font-medium">{pct(r.meanHighFraction)}</td>
                <td className="text-right px-3 py-1.5 text-orange-600">{(r.meanHighFraction * 365).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
