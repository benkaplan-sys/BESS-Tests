import { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { DailyRecord, parseBackcastCSV } from '@/core/calibration';

interface Props {
  onData: (records: DailyRecord[]) => void;
}

export default function BackcastUpload({ onData }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [summary, setSummary] = useState<{
    dateRange: string;
    count: number;
  } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function processFile(file: File) {
    setParseError(null);
    setSummary(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const records = parseBackcastCSV(text);

        if (records.length === 0) {
          setParseError('No valid rows found. Ensure the file has a header and valid Date/Revenue columns.');
          return;
        }

        const first = records[0]!;
        const last = records[records.length - 1]!;
        const fmt = (d: Date) =>
          d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        setSummary({
          dateRange: `${fmt(first.date)} – ${fmt(last.date)}`,
          count: records.length,
        });
        onData(records);
      } catch (err) {
        setParseError(
          err instanceof Error ? err.message : 'Unknown parse error',
        );
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="space-y-3">
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        }`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        aria-label="Upload backcast CSV file"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleChange}
        />
        <div className="text-gray-500 text-sm">
          <div className="text-2xl mb-2">&#8593;</div>
          <p className="font-medium text-gray-700">
            Drag &amp; drop a CSV file here, or click to browse
          </p>
          <p className="text-xs mt-1 text-gray-400">
            Expected format: <code className="bg-gray-100 px-1 rounded">Date,Revenue (USD/MW-day)</code> with daily rows
          </p>
        </div>
      </div>

      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
          <span className="font-medium">Parse error:</span> {parseError}
        </div>
      )}

      {summary && fileName && (
        <div className="bg-green-50 border border-green-200 rounded p-3 text-sm text-green-800 flex flex-wrap gap-4">
          <span><span className="font-medium">File:</span> {fileName}</span>
          <span><span className="font-medium">Date range:</span> {summary.dateRange}</span>
          <span><span className="font-medium">Days loaded:</span> {summary.count.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
