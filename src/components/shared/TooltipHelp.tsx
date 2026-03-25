import { useState } from 'react';

interface Props {
  text: string;
}

export default function TooltipHelp({ text }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        className="text-gray-400 hover:text-gray-600 focus:outline-none"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        aria-label="Help"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
        </svg>
      </button>
      {visible && (
        <div className="absolute z-50 w-64 rounded-md bg-gray-900 px-3 py-2 text-xs text-white shadow-lg left-6 top-0 pointer-events-none">
          {text}
          <div className="absolute -left-1 top-2 h-2 w-2 rotate-45 bg-gray-900" />
        </div>
      )}
    </span>
  );
}
