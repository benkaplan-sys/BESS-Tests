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
import { AnnualCalibStats } from '@/core/calibration';

interface Props {
  annualStats: AnnualCalibStats[];
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string | number;
  stats?: AnnualCalibStats[];
}

function CustomTooltip({ active, payload, label, stats }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const year = typeof label === 'number' ? label : parseInt(String(label), 10);
  const stat = stats?.find((s) => s.calYear === year);

  return (
    <div className="bg-white border border-gray-200 rounded shadow p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-800">{year}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === 'normalDollarMean' ? 'Normal $/day' : 'High $/day'}:{' '}
          <span className="font-medium">${p.value.toFixed(0)}</span>
        </p>
      ))}
      {stat && (
        <p className="text-gray-500">
          High fraction:{' '}
          <span className="font-medium">{(stat.highFraction * 100).toFixed(1)}%</span>
        </p>
      )}
    </div>
  );
}

const fmtDollar = (v: number) => `$${v.toFixed(0)}`;

export default function AnnualStatsChart({ annualStats }: Props) {
  if (annualStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No annual data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={annualStats}
        margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="calYear" tick={{ fontSize: 10 }} />
        <YAxis tickFormatter={fmtDollar} tick={{ fontSize: 10 }} width={55} />
        <Tooltip
          content={<CustomTooltip stats={annualStats} />}
        />
        <Legend
          formatter={(value) =>
            value === 'normalDollarMean' ? 'Normal $/day' : 'High $/day'
          }
          wrapperStyle={{ fontSize: 11 }}
        />
        <Bar dataKey="normalDollarMean" name="normalDollarMean" fill="#3b82f6" />
        <Bar dataKey="highDollarMean" name="highDollarMean" fill="#f97316" />
      </BarChart>
    </ResponsiveContainer>
  );
}
