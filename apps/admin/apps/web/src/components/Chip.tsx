import type { ReactElement, ReactNode } from 'react';

export type ChipTone = 'ok' | 'bad' | 'info' | 'notice';

/**
 * A status chip always carries its word as well as its colour (§7 of the design):
 * a verdict that reads as "clean" must say "clean", and a tool error must never be
 * styled as one.
 */
export function Chip({ tone, children }: { tone: ChipTone; children: ReactNode }): ReactElement {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

export function Notice({
  tone = 'notice',
  children,
}: {
  tone?: ChipTone;
  children: ReactNode;
}): ReactElement {
  const modifier = tone === 'ok' ? 'notice--ok' : tone === 'bad' ? 'notice--bad' : '';
  // A failure interrupts, so it is an alert; a confirmation waits its turn, so it is a
  // status. Both are announced — "Saved." was silent before this line existed.
  return (
    <div className={`notice ${modifier}`} role={tone === 'bad' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
