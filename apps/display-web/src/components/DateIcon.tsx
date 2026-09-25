import React from 'react';

export function DateIcon({ hijri = false }: { hijri?: boolean }) {
  return (
    <svg className="date-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      {hijri ? (
        <>
          <path fill="currentColor" d="M20 2.5A13.5 13.5 0 1 0 29.5 20 11.4 11.4 0 0 1 20 2.5Z" />
          <path fill="currentColor" d="m25 4 1.2 3.5L30 9l-3.8 1.3L25 14l-1.3-3.7L20 9l3.7-1.5Z" />
        </>
      ) : (
        <>
          <g fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="26" height="24" rx="2" />
            <path d="M3 12h26M10 2v7M22 2v7" />
          </g>
          <g fill="currentColor">
            <rect x="8" y="16" width="3" height="3" rx=".4" />
            <rect x="14.5" y="16" width="3" height="3" rx=".4" />
            <rect x="21" y="16" width="3" height="3" rx=".4" />
            <rect x="8" y="23" width="3" height="3" rx=".4" />
            <rect x="14.5" y="23" width="3" height="3" rx=".4" />
            <rect x="21" y="23" width="3" height="3" rx=".4" />
          </g>
        </>
      )}
    </svg>
  );
}
