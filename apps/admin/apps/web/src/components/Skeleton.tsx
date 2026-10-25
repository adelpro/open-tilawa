import type { ReactElement } from 'react';

/**
 * Placeholder rows for a list that is waiting.
 *
 * The shape matters more than the shimmer: each row is the height of a real row and the
 * bars sit where a label, an identifier and a line of metadata sit, so the swap when the
 * data lands is a repaint rather than a jump. That is the whole point — before this, every
 * list rendered the word "Loading…" and then replaced it with rows of a different height,
 * a layout shift at the exact moment someone started reading.
 *
 * `role="status"` with an accessible name, and every bar `aria-hidden`, so a screen reader
 * hears "Loading profiles" once rather than a column of nothing.
 */
export function SkeletonRows({
  rows = 3,
  label,
  className = '',
}: {
  rows?: number;
  label: string;
  className?: string;
}): ReactElement {
  return (
    <div className={`skeleton ${className}`.trim()} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div className="skeleton__row" key={index} aria-hidden="true">
          <span className="skeleton__bar skeleton__bar--lg" />
          <span className="skeleton__bar skeleton__bar--md" />
          <span className="skeleton__bar skeleton__bar--sm" />
        </div>
      ))}
    </div>
  );
}

/** A heading and a lede that are about to arrive. Used while the session resolves. */
export function SkeletonHeading({ className = '' }: { className?: string }): ReactElement {
  return (
    <div className={`skeleton ${className}`.trim()} role="status" aria-label="Loading">
      <span className="skeleton__bar skeleton__bar--title" aria-hidden="true" />
      <span className="skeleton__bar skeleton__bar--lede" aria-hidden="true" />
    </div>
  );
}
