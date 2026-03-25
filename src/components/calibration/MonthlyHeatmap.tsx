import { DailyRecord } from '@/core/calibration';
import { SeasonDefinition } from '@/core/types';

interface Props {
  records: DailyRecord[];
  seasonDef: SeasonDefinition;
  onToggle: (month: number) => void;
}

const MONTH_ABBR = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function interpolateGreen(t: number): string {
  // t in [0,1]: light green (low) to dark green (high)
  const r = Math.round(220 - t * 130);
  const g = Math.round(240 - t * 80);
  const b = Math.round(220 - t * 140);
  return `rgb(${r},${g},${b})`;
}

export default function MonthlyHeatmap({ records, seasonDef, onToggle }: Props) {
  // Compute mean revenue per month
  const monthSums = new Array(13).fill(0) as number[];
  const monthCounts = new Array(13).fill(0) as number[];

  for (const r of records) {
    monthSums[r.month]! += r.revenue;
    monthCounts[r.month]!++;
  }

  const monthMeans: number[] = new Array(13).fill(0) as number[];
  for (let m = 1; m <= 12; m++) {
    const count = monthCounts[m] ?? 0;
    monthMeans[m] = count > 0 ? (monthSums[m] ?? 0) / count : 0;
  }

  const vals = monthMeans.slice(1);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">
        Click a month badge to toggle Summer / Other season designation.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
          const mean = monthMeans[month] ?? 0;
          const t = (mean - minVal) / range;
          const bgColor = interpolateGreen(t);
          const season = seasonDef[month] ?? 'other';
          const isSummer = season === 'summer';

          return (
            <div
              key={month}
              className="rounded-lg p-2 flex flex-col items-center gap-1 select-none"
              style={{ backgroundColor: bgColor }}
            >
              <span className="text-xs font-semibold text-gray-800">
                {MONTH_ABBR[month] ?? ''}
              </span>
              <span className="text-xs text-gray-700">
                {mean > 0 ? `$${mean.toFixed(0)}` : '—'}
              </span>
              <button
                className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${
                  isSummer
                    ? 'bg-orange-400 border-orange-500 text-white hover:bg-orange-500'
                    : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => onToggle(month)}
                title={`Click to toggle ${MONTH_ABBR[month] ?? ''} to ${isSummer ? 'Other' : 'Summer'}`}
              >
                {isSummer ? 'Summer' : 'Other'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
