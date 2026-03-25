import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ClassifiedRecord } from '@/core/calibration';

interface Props {
  records: ClassifiedRecord[];
  height?: number;
}

interface WeeklyPoint {
  weekLabel: string;
  weekTimestamp: number;
  normalWeeklyRev: number | null;
  highWeeklyRev: number | null;
}

function getISOWeek(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 +
    Math.round(
      ((d.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7,
    );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

function aggregateWeekly(records: ClassifiedRecord[]): WeeklyPoint[] {
  const weekMap = new Map<
    string,
    { normalRevs: number[]; highRevs: number[]; timestamp: number }
  >();

  for (const r of records) {
    const key = getISOWeek(r.date);
    if (!weekMap.has(key)) {
      weekMap.set(key, {
        normalRevs: [],
        highRevs: [],
        timestamp: r.date.getTime(),
      });
    }
    const entry = weekMap.get(key)!;
    if (r.regime === 'normal') {
      entry.normalRevs.push(r.revenue);
    } else {
      entry.highRevs.push(r.revenue);
    }
  }

  const points: WeeklyPoint[] = [];
  for (const [key, entry] of weekMap) {
    const normalCount = entry.normalRevs.length;
    const highCount = entry.highRevs.length;
    const dominantIsHigh = highCount >= normalCount;

    const normalMean =
      normalCount > 0
        ? entry.normalRevs.reduce((s, v) => s + v, 0) / normalCount
        : null;
    const highMean =
      highCount > 0
        ? entry.highRevs.reduce((s, v) => s + v, 0) / highCount
        : null;

    points.push({
      weekLabel: key,
      weekTimestamp: entry.timestamp,
      normalWeeklyRev: dominantIsHigh ? null : normalMean,
      highWeeklyRev: dominantIsHigh ? highMean : null,
    });
  }

  points.sort((a, b) => a.weekTimestamp - b.weekTimestamp);
  return points;
}

const fmtDollar = (v: number) => `$${v.toFixed(0)}`;

export default function RevenueTimeSeriesChart({ records, height = 280 }: Props) {
  if (records.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
        No data to display
      </div>
    );
  }

  const data = aggregateWeekly(records);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 10 }}
          tickCount={8}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={fmtDollar}
          tick={{ fontSize: 11 }}
          width={65}
          label={{ value: '$/MW-day', angle: -90, position: 'insideLeft', offset: -5, style: { fontSize: 10 } }}
        />
        <Tooltip
          formatter={(value: number, name: string) => [
            `$${value.toFixed(2)}/MW-day`,
            name === 'normalWeeklyRev' ? 'Normal Regime (weekly avg)' : 'High Regime (weekly avg)',
          ]}
          labelFormatter={(label: string) => `Week: ${label}`}
        />
        <Legend
          formatter={(value) =>
            value === 'normalWeeklyRev' ? 'Normal Regime' : 'High Regime'
          }
        />
        <Line
          type="monotone"
          dataKey="normalWeeklyRev"
          stroke="#3b82f6"
          strokeWidth={1.5}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="highWeeklyRev"
          stroke="#f97316"
          strokeWidth={1.5}
          dot={false}
          connectNulls={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
