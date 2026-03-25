import { YearParams } from '@/core/types';
import { AnnualCalibStats, generateForwardParams } from '@/core/calibration';
import { CalibrationOptions } from '@/core/calibration';

interface Props {
  params: YearParams[];
  startYear: number;
  onChange: (params: YearParams[]) => void;
  growthRate: number;
  onGrowthRateChange: (g: number) => void;
  annualStats: AnnualCalibStats[];
  options: CalibrationOptions;
  summerHazards: { nToH: number[]; hToN: number[] };
  otherHazards: { nToH: number[]; hToN: number[] };
  seasonDef: import('@/core/types').SeasonDefinition;
}

function dollarMean(mu: number, sigma: number): number {
  return Math.exp(mu + 0.5 * sigma * sigma);
}

export default function ForwardParamsEditor({
  params,
  startYear,
  onChange,
  growthRate,
  onGrowthRateChange,
  annualStats,
  options,
  summerHazards,
  otherHazards,
  seasonDef,
}: Props) {
  function handleGrowthChange(newGrowth: number) {
    onGrowthRateChange(newGrowth);
    // Recalculate all year mus from year-1 base using log-space growth
    if (params.length === 0) return;
    const base = params[0]!;
    const logGrowth = Math.log(1 + newGrowth);
    const updated = params.map((p, i) => ({
      ...p,
      normal: { ...p.normal, mu: base.normal.mu + logGrowth * i },
      high: { ...p.high, mu: base.high.mu + logGrowth * i },
    }));
    onChange(updated);
  }

  function handleRecalibrate() {
    const fresh = generateForwardParams(
      annualStats,
      { ...options, growthRatePerYear: growthRate },
      summerHazards,
      otherHazards,
      seasonDef,
    );
    onChange(fresh);
  }

  function handleParamChange(
    yearIndex: number,
    field: 'normalMu' | 'normalSigma' | 'highMu' | 'highSigma',
    rawValue: string,
  ) {
    const value = parseFloat(rawValue);
    if (!isFinite(value)) return;

    const updated = params.map((p, i) => {
      if (i !== yearIndex) return p;
      switch (field) {
        case 'normalMu':
          return { ...p, normal: { ...p.normal, mu: value } };
        case 'normalSigma':
          return { ...p, normal: { ...p.normal, sigma: Math.max(value, 0.001) } };
        case 'highMu':
          return { ...p, high: { ...p.high, mu: value } };
        case 'highSigma':
          return { ...p, high: { ...p.high, sigma: Math.max(value, 0.001) } };
      }
    });
    onChange(updated);
  }

  return (
    <div className="space-y-4">
      {/* Growth rate control */}
      <div className="flex flex-wrap items-center gap-4">
        <label className="label flex items-center gap-2 flex-1 min-w-[240px]">
          <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
            Annual Growth Rate:
          </span>
          <input
            type="range"
            min={0}
            max={0.20}
            step={0.005}
            value={growthRate}
            onChange={(e) => handleGrowthChange(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm font-semibold text-blue-700 w-14 text-right">
            {(growthRate * 100).toFixed(1)}%
          </span>
        </label>
        <button
          className="btn-secondary text-xs"
          onClick={handleRecalibrate}
          title="Reset to values derived from historical data"
        >
          Recalibrate from data
        </button>
      </div>

      {/* Parameter table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-2 py-2 text-left font-medium text-gray-600">Year</th>
              <th className="px-2 py-2 text-center font-medium text-blue-700">Normal μ</th>
              <th className="px-2 py-2 text-center font-medium text-blue-700">Normal σ</th>
              <th className="px-2 py-2 text-center font-medium text-blue-600 bg-blue-50">Normal $/day</th>
              <th className="px-2 py-2 text-center font-medium text-orange-700">High μ</th>
              <th className="px-2 py-2 text-center font-medium text-orange-700">High σ</th>
              <th className="px-2 py-2 text-center font-medium text-orange-600 bg-orange-50">High $/day</th>
            </tr>
          </thead>
          <tbody>
            {params.map((p, i) => {
              const calYear = startYear + i;
              const normalDollar = dollarMean(p.normal.mu, p.normal.sigma);
              const highDollar = dollarMean(p.high.mu, p.high.sigma);

              return (
                <tr
                  key={p.year}
                  className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-2 py-1.5 font-medium text-gray-700">
                    Yr {p.year}
                    <span className="text-gray-400 font-normal ml-1">({calYear})</span>
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step={0.01}
                      value={p.normal.mu.toFixed(3)}
                      onChange={(e) => handleParamChange(i, 'normalMu', e.target.value)}
                      className="input-field w-20 text-center text-xs py-1"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step={0.01}
                      min={0.001}
                      value={p.normal.sigma.toFixed(3)}
                      onChange={(e) => handleParamChange(i, 'normalSigma', e.target.value)}
                      className="input-field w-20 text-center text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center bg-blue-50 font-medium text-blue-800">
                    ${normalDollar.toFixed(0)}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step={0.01}
                      value={p.high.mu.toFixed(3)}
                      onChange={(e) => handleParamChange(i, 'highMu', e.target.value)}
                      className="input-field w-20 text-center text-xs py-1"
                    />
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="number"
                      step={0.01}
                      min={0.001}
                      value={p.high.sigma.toFixed(3)}
                      onChange={(e) => handleParamChange(i, 'highSigma', e.target.value)}
                      className="input-field w-20 text-center text-xs py-1"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center bg-orange-50 font-medium text-orange-800">
                    ${highDollar.toFixed(0)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
