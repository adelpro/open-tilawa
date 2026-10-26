import type { ReactElement } from 'react';

import { cn } from '@/utils/cn';

export type IconName =
  | 'playlist'
  | 'wifi'
  | 'chevron-up'
  | 'chevron-left'
  | 'chevron-right'
  | 'dots'
  | 'close'
  | 'play'
  | 'pause';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/**
 * Every glyph in the app, hand-drawn on a 24px grid. No icon package: the
 * project has no UI dependencies, and nine paths are cheaper to read than a
 * dependency to audit.
 */
const GLYPHS: Record<IconName, ReactElement> = {
  playlist: (
    <>
      <path {...STROKE} d="M4 6h9M4 12h9M4 18h5" />
      <path {...STROKE} d="M17 6v9.2" />
      <circle {...STROKE} cx="15" cy="17" r="2" />
    </>
  ),
  wifi: (
    <>
      <path {...STROKE} d="M4.5 9.5a11 11 0 0 1 15 0" />
      <path {...STROKE} d="M7.8 13a6.5 6.5 0 0 1 8.4 0" />
      <path {...STROKE} d="M10.9 16.4a2.2 2.2 0 0 1 2.2 0" />
    </>
  ),
  'chevron-up': <path {...STROKE} d="M6 15l6-6 6 6" />,
  'chevron-left': <path {...STROKE} d="M15 5l-7 7 7 7" />,
  'chevron-right': <path {...STROKE} d="M9 5l7 7-7 7" />,
  dots: (
    <>
      <circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  close: <path {...STROKE} d="M6 6l12 12M18 6L6 18" />,
  play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" />,
  pause: <path d="M8 5h3v14H8zM13 5h3v14h-3z" fill="currentColor" />,
};

export default function Icon({
  name,
  className,
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5 shrink-0', className)}>
      {GLYPHS[name]}
    </svg>
  );
}
