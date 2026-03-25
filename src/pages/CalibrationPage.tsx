import { useState, useEffect, useRef } from 'react';
import {
  DailyRecord,
  CalibrationOptions,
  CalibrationResult,
  DEFAULT_CALIBRATION_OPTIONS,
  calibrate,
} from '@/core/calibration';
import { SimulationConfig, YearParams, SeasonDefinition, DEFAULT_MOMENTUM, createDefaultConfig } from '@/core/types';
import BackcastUpload from '@/components/calibration/BackcastUpload';
import RevenueTimeSeriesChart from '@/components/calibration/RevenueTimeSeriesChart';
import AnnualStatsChart from '@/components/calibration/AnnualStatsChart';
import MonthlyHeatmap from '@/components/calibration/MonthlyHeatmap';
import TransitionHazardChart from '@/components/calibration/TransitionHazardChart';
import ForwardParamsEditor from '@/components/calibration/ForwardParamsEditor';

interface Props {
  onApplyConfig: (config: SimulationConfig) => void;
}

export default function CalibrationPage({ onApplyConfig }: Props) {
  const [rawRecords, setRawRecords] = useState<DailyRecord[]>([]);
  const [options, setOptions] = useState<CalibrationOptions>(DEFAULT_CALIBRATION_OPTIONS);
  const [result, setResult] = useState<CalibrationResult | null>(null);
  const [editableForwardParams, setEditableForwardParams] = useState<YearParams[]>([]);
  const [editableSeasonDef, setEditableSeasonDef] = useState<SeasonDefinition>({});
  const [growthRate, setGrowthRate] = useState(0);

  const currentYear = new Date().getFullYear();
  const [simStartYear, setSimStartYear] = useState(currentYear + 1);
  const [simNumTrials, setSimNumTrials] = useState(1000);
  const [simSeed, setSimSeed] = useState(42);

  // Track whether user has manually edited params (so we don't override on re-calibrate)
  const userEditedRef = useRef(false);

  // Recompute calibration when rawRecords or options change
  useEffect(() => {
    if (rawRecords.length === 0) {
      setResult(null);
      return;
    }
    const newResult = calibrate(rawRecords, options);
    setResult(newResult);
    // Reset editable params unless user has manually edited them
    if (!userEditedRef.current) {
      setEditableForwardParams(newResult.forwardYearParams);
      setEditableSeasonDef(newResult.seasonDefinition);
      setGrowthRate(options.growthRatePerYear);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRecords, options]);

  // When result changes from a new calibration (not user edit), reset editable state
  function handleDataLoaded(records: DailyRecord[]) {
    userEditedRef.current = false;
    setRawRecords(records);
  }

  function handleForwardParamsChange(params: YearParams[]) {
    userEditedRef.current = true;
    setEditableForwardParams(params);
  }

  function handleSeasonToggle(month: number) {
    userEditedRef.current = true;
    setEditableSeasonDef((prev) => ({
      ...prev,
      [month]: prev[month] === 'summer' ? 'other' : 'summer',
    }));
  }

  function handleOptionsChange(partial: Partial<CalibrationOptions>) {
    userEditedRef.current = false;
    setOptions((prev) => ({ ...prev, ...partial }));
  }

  function handleApply() {
    if (!result || editableForwardParams.length === 0) return;

    const defaultCfg = createDefaultConfig();
    const config: SimulationConfig = {
      ...defaultCfg,
      baseSeed: simSeed,
      numTrials: simNumTrials,
      startYear: simStartYear,
      seasonDefinition: editableSeasonDef,
      years: editableForwardParams,
      momentum: DEFAULT_MOMENTUM,
    };
    onApplyConfig(config);
  }

  const thresholdDollarValue = result ? result.highThreshold.toFixed(0) : null;
  const yearsOptions = Array.from({ length: 10 }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Section 1: Import */}
      <div className="card p-4">
        <h2 className="text-base font-semibold text-gray-800 mb-3">
          Step 1 — Import Backcast Data
        </h2>
        <BackcastUpload onData={handleDataLoaded} />

        {rawRecords.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600 bg-gray-50 rounded p-3">
            <span>
              <span className="font-medium">Total days:</span>{' '}
              {rawRecords.length.toLocaleString()}
            </span>
            <span>
              <span className="font-medium">Years:</span>{' '}
              {[...new Set(rawRecords.map((r) => r.year))].sort().join(', ')}
            </span>
            {result && (
              <span>
                <span className="font-medium">High threshold (P{Math.round(options.thresholdPct * 100)}):</span>{' '}
                ${thresholdDollarValue}/MW-day
              </span>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Explore & Configure */}
      {rawRecords.length > 0 && result && (
        <div className="card p-4 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">
            Step 2 — Explore &amp; Configure
          </h2>

          {/* Controls row */}
          <div className="flex flex-wrap gap-6 items-end">
            <div>
              <label className="label block text-xs font-medium text-gray-600 mb-1">
                High-regime threshold (P{Math.round(options.thresholdPct * 100)})
                {thresholdDollarValue && (
                  <span className="ml-1 text-blue-700 font-semibold">
                    = ${thresholdDollarValue}/MW-day
                  </span>
                )}
              </label>
              <input
                type="range"
                min={0.50}
                max={0.95}
                step={0.05}
                value={options.thresholdPct}
                onChange={(e) =>
                  handleOptionsChange({ thresholdPct: parseFloat(e.target.value) })
                }
                className="w-48"
              />
              <div className="flex justify-between text-xs text-gray-400 w-48 mt-0.5">
                <span>P50</span>
                <span>P95</span>
              </div>
            </div>
            <div>
              <label className="label block text-xs font-medium text-gray-600 mb-1">
                Reference years (last N)
              </label>
              <select
                className="input-field text-sm"
                value={options.recentYearsCount}
                onChange={(e) =>
                  handleOptionsChange({ recentYearsCount: parseInt(e.target.value, 10) })
                }
              >
                {yearsOptions.map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? 'year' : 'years'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time series chart */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Revenue History</h3>
            <RevenueTimeSeriesChart records={result.records} height={260} />
          </div>

          {/* Two column: annual stats + monthly heatmap */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Annual Mean Revenue by Regime</h3>
              <AnnualStatsChart annualStats={result.annualStats} />
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">Monthly Seasonality</h3>
              <MonthlyHeatmap
                records={rawRecords}
                seasonDef={editableSeasonDef}
                onToggle={handleSeasonToggle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Section 3: Regime Transitions */}
      {result && (
        <div className="card p-4 space-y-3">
          <h2 className="text-base font-semibold text-gray-800">
            Step 3 — Regime Transitions
          </h2>
          <TransitionHazardChart
            summerHazards={result.summerHazards}
            otherHazards={result.otherHazards}
          />
          <p className="text-xs text-gray-500">
            Empirical duration-dependent transition probabilities. Each bar shows the
            probability of leaving the current regime after spending exactly that many
            consecutive days in it. Bins are capped at 10d+.
          </p>
        </div>
      )}

      {/* Section 4: Forward Year Parameters */}
      {result && editableForwardParams.length > 0 && (
        <div className="card p-4">
          <h2 className="text-base font-semibold text-gray-800 mb-3">
            Step 4 — Forward Year Parameters
          </h2>
          <ForwardParamsEditor
            params={editableForwardParams}
            startYear={simStartYear}
            onChange={handleForwardParamsChange}
            growthRate={growthRate}
            onGrowthRateChange={setGrowthRate}
            annualStats={result.annualStats}
            options={options}
            summerHazards={result.summerHazards}
            otherHazards={result.otherHazards}
            seasonDef={editableSeasonDef}
          />
        </div>
      )}

      {/* Section 5: Apply to Simulator */}
      {result && (
        <div className="card p-4 space-y-3">
          <h2 className="text-base font-semibold text-gray-800">
            Step 5 — Apply to Simulator
          </h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="label block text-xs font-medium text-gray-600 mb-1">
                Trials
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={simNumTrials}
                onChange={(e) => setSimNumTrials(parseInt(e.target.value, 10) || 1000)}
                className="input-field w-24 text-sm"
              />
            </div>
            <div>
              <label className="label block text-xs font-medium text-gray-600 mb-1">
                Seed
              </label>
              <input
                type="number"
                min={0}
                value={simSeed}
                onChange={(e) => setSimSeed(parseInt(e.target.value, 10) || 42)}
                className="input-field w-24 text-sm"
              />
            </div>
            <div>
              <label className="label block text-xs font-medium text-gray-600 mb-1">
                Start Year
              </label>
              <input
                type="number"
                min={2020}
                max={2060}
                value={simStartYear}
                onChange={(e) => setSimStartYear(parseInt(e.target.value, 10) || currentYear + 1)}
                className="input-field w-24 text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Note: Momentum, season definition, and transition probabilities can be further
            adjusted in the Simulator tab after loading.
          </p>
          <button
            className="btn-primary"
            onClick={handleApply}
            disabled={editableForwardParams.length === 0}
          >
            Load into Simulator →
          </button>
        </div>
      )}
    </div>
  );
}
