import type { SVGProps } from 'react';

/**
 * Hand-drawn icon set, in the spirit of the rest of the app: no icon library,
 * no font, one 24-unit grid, `currentColor` only.
 */
export type IconName =
  | 'play'
  | 'pause'
  | 'previous'
  | 'next'
  | 'repeat'
  | 'repeatOne'
  | 'shuffle'
  | 'download'
  | 'queue'
  | 'search'
  | 'moon'
  | 'sun'
  | 'close'
  | 'chevron'
  | 'library'
  | 'info'
  | 'more'
  | 'check'
  | 'speed';

const STROKE: Partial<Record<IconName, string>> = {
  previous: 'M18 5v14L8 12zM6 5v14',
  next: 'M6 5v14l10-7zM18 5v14',
  repeat: 'M4 9h13a3 3 0 0 1 3 3M20 15H7a3 3 0 0 1-3-3M7 5l-3 4 3 4M17 19l3-4-3-4',
  repeatOne: 'M4 9h13a3 3 0 0 1 3 3M20 15H7a3 3 0 0 1-3-3M7 5l-3 4 3 4M17 19l3-4-3-4',
  shuffle: 'M4 6h3l10 12h3M4 18h3L17 6h3M17 3l3 3-3 3M17 15l3 3-3 3',
  download: 'M12 4v11M7.5 11l4.5 4.5 4.5-4.5M5 19h14',
  queue: 'M5 7h14M5 12h14M5 17h9',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 20 20',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z',
  sun: 'M12 16.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'M9 6l6 6-6 6',
  library: 'M4 5h6v14H4zM14 5h6v14h-6M7 9v4M17 9v4',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8.2v.1',
  more: 'M6 12h.01M12 12h.01M18 12h.01',
  check: 'M5 12.5 10 17l9-10',
  speed: 'M12 20a8 8 0 1 1 8-8M12 12l4-4',
};

export function Icon({
  name,
  size = 20,
  ...props
}: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...props}>
        <path d="M7 4.5 20 12 7 19.5z" fill="currentColor" />
      </svg>
    );
  }
  if (name === 'pause') {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" {...props}>
        <path d="M7 4.5h3.5v15H7zM13.5 4.5H17v15h-3.5z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={STROKE[name] ?? ''} />
      {name === 'repeatOne' && (
        <text x="12" y="12.4" textAnchor="middle" fontSize="7" fill="currentColor" stroke="none">
          1
        </text>
      )}
    </svg>
  );
}
