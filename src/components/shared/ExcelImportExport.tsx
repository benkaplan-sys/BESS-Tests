import { useRef, useState } from 'react';
import { SimulationConfig } from '@/core/types';
import { downloadExcelTemplate, parseExcelTemplate } from '@/core/excelTemplate';

interface Props {
  config: SimulationConfig;
  onImport: (config: SimulationConfig) => void;
}

export default function ExcelImportExport({ config, onImport }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [errors, setErrors]     = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [success, setSuccess]   = useState(false);

  const handleDownload = () => {
    downloadExcelTemplate(config);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setErrors([]);
    setWarnings([]);
    setSuccess(false);

    try {
      const buffer = await file.arrayBuffer();
      const result = parseExcelTemplate(buffer);

      if (result.errors.length > 0) {
        setErrors(result.errors);
      } else if (result.config) {
        setWarnings(result.warnings);
        setSuccess(true);
        onImport(result.config);
        // Reset after 3s
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setErrors(['Unknown parse error.']);
      }
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Failed to parse file.']);
    } finally {
      setImporting(false);
      // Reset input so the same file can be re-uploaded after fixing errors
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 flex-wrap">
        {/* Download current config as template */}
        <button
          type="button"
          onClick={handleDownload}
          className="btn-secondary flex items-center gap-1.5 text-sm"
          title="Download the current inputs as an Excel template you can edit and re-upload"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export to Excel
        </button>

        {/* Upload filled template */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={importing}
          className="btn-secondary flex items-center gap-1.5 text-sm"
          title="Upload a filled Excel template to load all inputs at once"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" />
          </svg>
          {importing ? 'Importing…' : 'Import from Excel'}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => void handleFileChange(e)}
        />
      </div>

      {/* Success */}
      {success && (
        <div className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 border border-green-200 flex items-center gap-1">
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
          </svg>
          Inputs loaded successfully from Excel.
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200 space-y-0.5">
          {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div className="text-xs text-red-700 bg-red-50 rounded px-2 py-1 border border-red-200 space-y-0.5 max-h-32 overflow-y-auto">
          <div className="font-semibold mb-1">Import errors — fix these in the spreadsheet and re-upload:</div>
          {errors.map((err, i) => <div key={i}>• {err}</div>)}
        </div>
      )}

      <p className="text-xs text-gray-400">
        Export your current inputs to Excel, edit them, then import to reload.
      </p>
    </div>
  );
}
