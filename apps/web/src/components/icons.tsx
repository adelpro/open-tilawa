import type { ReactElement } from 'react';

import { cn } from '@/utils/cn';

export type IconName = 'chevron-left' | 'chevron-right' | 'playlist' | 'wifi' | 'link';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

const GLYPHS = {
  'chevron-left': <path {...STROKE} d="M15 5l-7 7 7 7" />,
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
} satisfies Record<IconName, ReactElement>;

export default function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('h-5 w-5 shrink-0', className)}>
      {GLYPHS[name]}
    </svg>
  );
}
