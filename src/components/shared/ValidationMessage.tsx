import { ValidationIssue } from '@/core/types';

interface Props {
  issue: ValidationIssue;
}

export default function ValidationMessage({ issue }: Props) {
  const isError = issue.severity === 'error';
  return (
    <div
      className={`flex items-start gap-2 rounded px-2 py-1.5 text-xs ${
        isError ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
      }`}
    >
      <span className="mt-0.5 shrink-0">
        {isError ? '✗' : '⚠'}
      </span>
      <div>
        <span className="font-mono text-xs opacity-70">{issue.field}: </span>
        {issue.message}
      </div>
    </div>
  );
}
