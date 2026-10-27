import type { ReactElement } from 'react';

import { cn } from '@/utils/cn';

export type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'playlist'
  | 'wifi'
  | 'link'
  | 'mic'
  | 'search'
  | 'close'
  | 'volume'
  | 'volume-x'
  | 'users'
  | 'download'
  | 'upload'
  | 'file'
  | 'activity'
  | 'server';
const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GLYPHS = {
  'chevron-left': <path {...STROKE} d="M15 5l-7 7 7 7" />,
  search: (
    <>
      <circle {...STROKE} cx="11" cy="11" r="6.5" />
      <path {...STROKE} d="M20 20l-4.4-4.4" />
    </>
  ),
  close: <path {...STROKE} d="M6 6l12 12M18 6L6 18" />,
  volume: (
    <>
      <path {...STROKE} d="M4 9.5h3.5L12 6v12L7.5 14.5H4z" />
      <path {...STROKE} d="M15.5 9a4 4 0 0 1 0 6" />
      <path {...STROKE} d="M18 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
  "volume-x": (
    <>
      <path {...STROKE} d="M4 9.5h3.5L12 6v12L7.5 14.5H4z" />
      <path {...STROKE} d="M16 9.5l5 5M21 9.5l-5 5" />
    </>
  ),
  mic: (
    <>
      <rect {...STROKE} x="9" y="3" width="6" height="11" rx="3" />
      <path {...STROKE} d="M5.5 11a6.5 6.5 0 0 0 13 0" />
      <path {...STROKE} d="M12 17.5V21" />
    </>
  ),
  'chevron-right': <path {...STROKE} d="M9 5l7 7-7 7" />,
  playlist: (
    <>
      <path {...STROKE} d="M4 6h9M4 12h9M4 18h5" />
      <path {...STROKE} d="M17 6v9.2" />
      <circle {...STROKE} cx="15" cy="17" r="2" />
    </>
  ),
  link: (
    <>
      <path {...STROKE} d="M10 13a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1" />
      <path {...STROKE} d="M14 11a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1" />
    </>
  ),
  wifi: (
    <>
      <path {...STROKE} d="M4.5 9.5a11 11 0 0 1 15 0" />
      <path {...STROKE} d="M7.8 13a6.5 6.5 0 0 1 8.4 0" />
      <path {...STROKE} d="M10.9 16.4a2.2 2.2 0 0 1 2.2 0" />
    </>
  ),
  users: (
    <>
      <circle {...STROKE} cx="9" cy="8" r="3" />
      <path {...STROKE} d="M4 18c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <circle {...STROKE} cx="16" cy="9" r="2.2" />
      <path {...STROKE} d="M17 18c0-1.9-1.2-3.5-2.9-4.2" />
    </>
  ),
  download: (
    <>
      <path {...STROKE} d="M12 3v10M7 10l5 5 5-5" />
      <path {...STROKE} d="M5 18h14" />
    </>
  ),
  upload: (
    <>
      <path {...STROKE} d="M12 13V3M7 6l5-3 5 3" />
      <path {...STROKE} d="M5 18h14" />
    </>
  ),
  file: (
    <>
      <path {...STROKE} d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <path {...STROKE} d="M14 2v5h5" />
    </>
  ),
  activity: (
    <>
      <path {...STROKE} d="M3 12h4l3-8 4 16 3-8h4" />
    </>
  ),
  server: (
    <>
      <rect {...STROKE} x="4" y="4" width="16" height="6" rx="2" />
      <rect {...STROKE} x="4" y="14" width="16" height="6" rx="2" />
      <circle cx="8" cy="7" r="0.8" fill="currentColor" />
      <circle cx="8" cy="17" r="0.8" fill="currentColor" />
    </>
  ),
} satisfies Record<IconName, ReactElement>;

export default function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5 shrink-0', className)}>
      {GLYPHS[name]}
    </svg>
  );
}
