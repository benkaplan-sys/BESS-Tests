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

interface HazardSeries {
  nToH: number[];
  hToN: number[];
}

interface Props {
  summerHazards: HazardSeries;
  otherHazards: HazardSeries;
}

const DURATION_LABELS = ['1d', '2d', '3d', '4d', '5d', '6d', '7d', '8d', '9d', '10d+'];

function buildChartData(hazards: HazardSeries) {
  return DURATION_LABELS.map((label, i) => ({
    duration: label,
    nToH: hazards.nToH[i] ?? 0,
    hToN: hazards.hToN[i] ?? 0,
  }));
}

const fmtPct = (v: number) => `${(v * 100).toFixed(1)}%`;

interface HazardBarChartProps {
  title: string;
  data: ReturnType<typeof buildChartData>;
}

function HazardBarChart({ title, data }: HazardBarChartProps) {
  return (
    <div className="flex-1 min-w-0">
      <h4 className="text-xs font-semibold text-gray-600 mb-1 text-center">{title}</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="duration" tick={{ fontSize: 10 }} />
          <YAxis
            tickFormatter={fmtPct}
            tick={{ fontSize: 10 }}
            domain={[0, 1]}
            width={50}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              fmtPct(value),
              name === 'nToH' ? 'Normal → High' : 'High → Normal',
            ]}
            labelFormatter={(label: string) => `Duration: ${label}`}
          />
          <Legend
            formatter={(value) =>
              value === 'nToH' ? 'Normal → High' : 'High → Normal'
            }
            wrapperStyle={{ fontSize: 11 }}
          />
          <Bar dataKey="nToH" name="nToH" fill="#3b82f6" />
          <Bar dataKey="hToN" name="hToN" fill="#f97316" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TransitionHazardChart({ summerHazards, otherHazards }: Props) {
  const summerData = buildChartData(summerHazards);
  const otherData = buildChartData(otherHazards);

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <HazardBarChart title="Summer Season" data={summerData} />
      <HazardBarChart title="Other Season" data={otherData} />
    </div>
  );
}
