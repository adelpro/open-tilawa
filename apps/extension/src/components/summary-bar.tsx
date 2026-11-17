/**
 * The bar that answers "what am I about to give, and may I".
 *
 * It is fixed to the bottom because the decision is made while reading the
 * roster, not after scrolling back up; the page reserves space for it so the last
 * row is never trapped underneath.
 */

import { formatBytes } from '@/lib/badge';

export function SummaryBar({
  selectedCount,
  selectedBytes,
  capReciters,
  followCount,
  allowed,
  running,
  refusal,
  status,
  busy,
  disabled = false,
  labels,
  onPrimary,
}: {
  selectedCount: number;
  selectedBytes: number;
  capReciters: number;
  /** Held by following; a second budget, shown beside the manual one. */
  followCount: number;
  allowed: boolean;
  /** Held reciters exist and the background is not paused. */
  running: boolean;
  refusal: string;
  status: { text: string; tone: 'idle' | 'error' };
  busy: boolean;
  /** Nothing to start: a bar that toggles an empty seeder is a lie. */
  disabled?: boolean;
  labels: { selected: string; cap: string; follow?: string; start: string; pause: string };
  onPrimary: () => void;
}) {
  return (
    <div className="bar">
      <span className="totals">
        {labels.selected}: <bdi>{selectedCount}</bdi> · <bdi>{formatBytes(selectedBytes)}</bdi> /{' '}
        {labels.cap}: <bdi>{capReciters}</bdi>
        {labels.follow && followCount > 0 ? (
          <>
            {' · '}
            {labels.follow}: <bdi>{followCount}</bdi>
          </>
        ) : null}
      </span>
      <button
        type="button"
        className="primary"
        onClick={onPrimary}
        disabled={busy || disabled || (!running && !allowed)}
      >
        {running ? labels.pause : labels.start}
      </button>
      <span className="status" data-tone={status.tone}>
        {allowed ? status.text : refusal}
      </span>
    </div>
  );
}
