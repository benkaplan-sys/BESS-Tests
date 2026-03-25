import { SeasonDefinition, Season } from '@/core/types';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  value: SeasonDefinition;
  onChange: (sd: SeasonDefinition) => void;
}

export default function SeasonDefinitionInput({ value, onChange }: Props) {
  const toggle = (month: number) => {
    const current: Season = value[month] ?? 'other';
    const next: Season = current === 'summer' ? 'other' : 'summer';
    onChange({ ...value, [month]: next });
  };

  const summerMonths = Object.entries(value)
    .filter(([, s]) => s === 'summer')
    .map(([m]) => parseInt(m))
    .sort((a, b) => a - b);

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">Click months to toggle between Summer and Other season.</p>
      <div className="grid grid-cols-4 gap-1">
        {MONTH_NAMES.map((name, i) => {
          const month = i + 1;
          const isSummer = value[month] === 'summer';
          return (
            <button
              key={month}
              type="button"
              onClick={() => toggle(month)}
              className={`rounded px-2 py-1.5 text-xs font-medium border transition-colors ${
                isSummer
                  ? 'bg-orange-100 border-orange-300 text-orange-800 hover:bg-orange-200'
                  : 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-3 text-xs text-gray-500 mt-1">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-orange-200" /> Summer ({summerMonths.length})
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-blue-100" /> Other ({12 - summerMonths.length})
        </span>
      </div>
    </div>
  );
}
