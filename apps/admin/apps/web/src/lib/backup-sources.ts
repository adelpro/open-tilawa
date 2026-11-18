/**
 * How a source's last check should read on the screen.
 *
 * A successful check older than the host job's 26-hour stale window is "stale",
 * not "healthy": the row must not promise a fresh connection it never made. A
 * failure stays a failure — age makes it worse, not better.
 */
export type SourceHealthKey = 'never' | 'ok' | 'failed' | 'stale';

export type SourceHealth = { key: SourceHealthKey; at: string | null; stale: boolean };

const STALE_MS = 26 * 60 * 60 * 1000;

export function sourceHealth(
  target: { lastState: string | null; lastCheckedAt: string | null },
  now = Date.now(),
): SourceHealth {
  if (!target.lastState || !target.lastCheckedAt) {
    return { key: 'never', at: null, stale: false };
  }
  const at = Date.parse(target.lastCheckedAt);
  const stale = Number.isFinite(at) && now - at > STALE_MS;
  if (target.lastState === 'ok') {
    return { key: stale ? 'stale' : 'ok', at: target.lastCheckedAt, stale };
  }
  return { key: 'failed', at: target.lastCheckedAt, stale };
}
