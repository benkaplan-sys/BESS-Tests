import { useState } from 'react';
import { YearParams } from '@/core/types';
import DistributionInputs from './DistributionInputs';
import MarkovInputs from './MarkovInputs';

interface Props {
  years: YearParams[];
  onChange: (years: YearParams[]) => void;
}

type SubTab = 'distributions' | 'markov';
type CopyField = 'distributions' | 'transitions' | 'all';
type CopyTarget = 'all' | 'remaining';

export default function YearTabPanel({ years, onChange }: Props) {
  const [activeYear, setActiveYear] = useState(0);
  const [subTab, setSubTab] = useState<SubTab>('distributions');

  const year = years[activeYear];
  if (!year) return null;

  const updateYear = (updated: YearParams) => {
    const next = [...years];
    next[activeYear] = updated;
    onChange(next);
  };

  const copyFields = (target: CopyTarget, field: CopyField) => {
    if (!year) return;
    const next = years.map((y, i) => {
      if (i === activeYear) return y;
      if (target === 'remaining' && i < activeYear) return y;
      return {
        ...y,
        ...(field !== 'transitions' ? { normal: year.normal, high: year.high } : {}),
        ...(field !== 'distributions' ? { summer: year.summer, other: year.other } : {}),
      };
    });
    onChange(next);
  };

  return (
    <div>
      {/* Year tabs */}
      <div className="flex gap-1 flex-wrap mb-3">
        {years.map((y, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveYear(i)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              activeYear === i
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Y{y.year}
          </button>
        ))}
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-100">
        {([
          ['distributions', 'Revenue Distributions'],
          ['markov', 'Transition Probabilities'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              subTab === key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {subTab === 'distributions' && (
        <div className="space-y-3">
          <DistributionInputs
            label="Normal Days"
            value={year.normal}
            onChange={(p) => updateYear({ ...year, normal: p })}
          />
          <DistributionInputs
            label="High Days"
            value={year.high}
            onChange={(p) => updateYear({ ...year, high: p })}
          />
        </div>
      )}

      {subTab === 'markov' && (
        <MarkovInputs
          summer={year.summer}
          other={year.other}
          onChange={(summer, other) => updateYear({ ...year, summer, other })}
        />
      )}

      {/* Copy controls */}
      <div className="mt-4 pt-3 border-t border-gray-100">
        <div className="text-xs font-medium text-gray-500 mb-2">
          Copy from Y{year.year}:
        </div>
        <div className="grid grid-cols-3 gap-1 text-xs items-center">
          <div />
          <div className="text-center font-medium text-gray-400">→ All Years</div>
          <div className="text-center font-medium text-gray-400">→ Y{year.year}+</div>

          <div className="flex items-center gap-1 text-gray-600">
            <span className="w-2 h-2 rounded-sm bg-blue-400 shrink-0 inline-block" />
            Distributions
          </div>
          <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => copyFields('all', 'distributions')}>Copy</button>
          <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => copyFields('remaining', 'distributions')}>Copy</button>

          <div className="flex items-center gap-1 text-gray-600">
            <span className="w-2 h-2 rounded-sm bg-orange-400 shrink-0 inline-block" />
            Transitions
          </div>
          <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => copyFields('all', 'transitions')}>Copy</button>
          <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => copyFields('remaining', 'transitions')}>Copy</button>

          <div className="flex items-center gap-1 text-gray-600">
            <span className="w-2 h-2 rounded-sm bg-gray-400 shrink-0 inline-block" />
            Both
          </div>
          <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => copyFields('all', 'all')}>Copy</button>
          <button type="button" className="btn-secondary py-0.5 text-xs" onClick={() => copyFields('remaining', 'all')}>Copy</button>
        </div>
      </div>
    </div>
  );
}
