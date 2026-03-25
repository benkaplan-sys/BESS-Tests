import { useState } from 'react';
import { SimulationConfig, SimulationResult, createDefaultConfig } from '@/core/types';
import { useSimulation } from '@/hooks/useSimulation';
import { useValidation } from '@/hooks/useValidation';
import SimSettings from '@/components/inputs/SimSettings';
import YearTabPanel from '@/components/inputs/YearTabPanel';
import SeasonDefinitionInput from '@/components/inputs/SeasonDefinitionInput';
import MomentumInput from '@/components/inputs/MomentumInput';
import AnnualSummaryTable from '@/components/outputs/AnnualSummaryTable';
import FanChart from '@/components/outputs/FanChart';
import RegimeBreakdown from '@/components/outputs/RegimeBreakdown';
import HistogramPanel from '@/components/outputs/HistogramPanel';
import LivePreviewPanel from '@/components/outputs/LivePreviewPanel';
import ConfigList from '@/components/saved/ConfigList';
import SaveConfigModal from '@/components/saved/SaveConfigModal';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import ValidationMessage from '@/components/shared/ValidationMessage';
import ExcelImportExport from '@/components/shared/ExcelImportExport';

type Tab = 'simulate' | 'saved';

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('simulate');
  const [config, setConfig] = useState<SimulationConfig>(createDefaultConfig());
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [outputTab, setOutputTab] = useState<'table' | 'chart' | 'regime' | 'histogram'>('chart');

  const { run, progress, isRunning } = useSimulation();
  const { issues } = useValidation(config);

  const errors = issues.filter((i) => i.severity === 'error');

  const handleRun = async () => {
    const simResult = await run(config);
    if (simResult) {
      setResult(simResult);
      setActiveTab('simulate');
    }
  };

  const handleLoadConfig = (loaded: SimulationConfig) => {
    setConfig(loaded);
    setResult(null);
    setActiveTab('simulate');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-800 text-white shadow-md">
        <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">BESS ERCOT Revenue Forecaster</h1>
            <p className="text-blue-200 text-xs mt-0.5">Stochastic Markov Regime-Switching Model</p>
          </div>
          <div className="flex gap-2">
            <button
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'simulate' ? 'bg-white text-blue-800' : 'text-blue-200 hover:text-white'}`}
              onClick={() => setActiveTab('simulate')}
            >
              Simulate
            </button>
            <button
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${activeTab === 'saved' ? 'bg-white text-blue-800' : 'text-blue-200 hover:text-white'}`}
              onClick={() => setActiveTab('saved')}
            >
              Saved Configurations
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {activeTab === 'simulate' && (
          <div className="space-y-6">
            {/* Left column: inputs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-1 space-y-4">
                <ErrorBoundary>
                  <div className="card p-4">
                    <h2 className="text-base font-semibold text-gray-800 mb-3">Simulation Settings</h2>
                    <SimSettings config={config} onChange={setConfig} />
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <div className="text-xs font-medium text-gray-500 mb-2">Excel Template</div>
                      <ExcelImportExport
                        config={config}
                        onImport={(loaded) => { setConfig(loaded); setResult(null); }}
                      />
                    </div>
                  </div>
                  <div className="card p-4">
                    <h2 className="text-base font-semibold text-gray-800 mb-3">Season Definition</h2>
                    <SeasonDefinitionInput
                      value={config.seasonDefinition}
                      onChange={(sd) => setConfig((c) => ({ ...c, seasonDefinition: sd }))}
                    />
                  </div>
                  <div className="card p-4">
                    <h2 className="text-base font-semibold text-gray-800 mb-3">Momentum</h2>
                    <MomentumInput
                      value={config.momentum}
                      onChange={(m) => setConfig((c) => ({ ...c, momentum: m }))}
                    />
                  </div>
                </ErrorBoundary>

                {/* Validation */}
                {issues.length > 0 && (
                  <div className="card p-4 space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Validation</h3>
                    {issues.map((issue, i) => (
                      <ValidationMessage key={i} issue={issue} />
                    ))}
                  </div>
                )}

                {/* Run button */}
                <div className="flex gap-2">
                  <button
                    className="btn-primary flex-1"
                    onClick={() => void handleRun()}
                    disabled={isRunning || errors.length > 0}
                  >
                    {isRunning ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Running... {progress.completedTrials}/{progress.totalTrials}
                      </>
                    ) : (
                      'Run Simulation'
                    )}
                  </button>
                  {result && (
                    <button
                      className="btn-secondary"
                      onClick={() => setShowSaveModal(true)}
                    >
                      Save
                    </button>
                  )}
                </div>
                {isRunning && progress.totalTrials > 0 && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div
                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                      style={{ width: `${(progress.completedTrials / progress.totalTrials) * 100}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Right: year params */}
              <div className="lg:col-span-2">
                <div className="card p-4">
                  <h2 className="text-base font-semibold text-gray-800 mb-3">Year Parameters</h2>
                  <ErrorBoundary>
                    <YearTabPanel
                      years={config.years}
                      onChange={(years) => setConfig((c) => ({ ...c, years }))}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            <ErrorBoundary>
              <LivePreviewPanel config={config} />
            </ErrorBoundary>

            {/* Output section */}
            {result && (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-gray-800">Simulation Results</h2>
                  <div className="flex gap-1 border border-gray-200 rounded-lg p-1 bg-gray-50">
                    {(['chart', 'table', 'regime', 'histogram'] as const).map((t) => (
                      <button
                        key={t}
                        className={`px-3 py-1 rounded text-xs font-medium capitalize transition-colors ${outputTab === t ? 'bg-white shadow text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
                        onClick={() => setOutputTab(t)}
                      >
                        {t === 'chart' ? 'Fan Chart' : t === 'regime' ? 'Regime' : t === 'histogram' ? 'Distribution' : 'Table'}
                      </button>
                    ))}
                  </div>
                </div>
                <ErrorBoundary>
                  {outputTab === 'chart' && <FanChart results={result.annualResults} startYear={config.startYear} />}
                  {outputTab === 'table' && <AnnualSummaryTable results={result.annualResults} startYear={config.startYear} />}
                  {outputTab === 'regime' && <RegimeBreakdown results={result.annualResults} startYear={config.startYear} />}
                  {outputTab === 'histogram' && <HistogramPanel results={result.annualResults} startYear={config.startYear} />}
                </ErrorBoundary>
              </div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <ErrorBoundary>
            <ConfigList onLoad={handleLoadConfig} />
          </ErrorBoundary>
        )}
      </main>

      {showSaveModal && result && (
        <SaveConfigModal
          config={config}
          result={result}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}
