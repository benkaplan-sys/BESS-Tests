import { AnnualResult } from '@/core/types';

interface Props {
  results: AnnualResult[];
  startYear: number;
}

const fmt = (v: number) => `$${(v / 1000).toFixed(1)}k`;
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function AnnualSummaryTable({ results, startYear }: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-semibold text-gray-600">Year</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-600">P10</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-600">P25</th>
            <th className="text-right px-3 py-2 font-semibold text-blue-700">P50</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-600">P75</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-600">P90</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-600">Mean</th>
            <th className="text-right px-3 py-2 font-semibold text-gray-600">Std Dev</th>
            <th className="text-right px-3 py-2 font-semibold text-orange-600">% High Days</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={r.year} className={`border-b border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50'} hover:bg-blue-50 transition-colors`}>
              <td className="px-3 py-2 font-medium text-gray-700">
                Y{r.year} <span className="text-gray-400">({startYear + r.year - 1})</span>
              </td>
              <td className="text-right px-3 py-2 text-gray-600">{fmt(r.p10)}</td>
              <td className="text-right px-3 py-2 text-gray-600">{fmt(r.p25)}</td>
              <td className="text-right px-3 py-2 font-semibold text-blue-700">{fmt(r.p50)}</td>
              <td className="text-right px-3 py-2 text-gray-600">{fmt(r.p75)}</td>
              <td className="text-right px-3 py-2 text-gray-600">{fmt(r.p90)}</td>
              <td className="text-right px-3 py-2 text-gray-600">{fmt(r.mean)}</td>
              <td className="text-right px-3 py-2 text-gray-500">{fmt(r.std)}</td>
              <td className="text-right px-3 py-2 text-orange-600 font-medium">{pct(r.meanHighFraction)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
