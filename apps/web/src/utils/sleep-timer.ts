export const SLEEP_OPTIONS = [0, 15, 30, 60, 90] as const;

/** `null` means "no timer": an explicit cancel, not a zero-length timer. */
export function sleepEndsAt(minutes: number, now: number = Date.now()): number | null {
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  return now + minutes * 60_000;
}

export function secondsLeft(endsAt: number | null, now: number = Date.now()): number {
  if (endsAt === null) return 0;
  return Math.max(0, Math.round((endsAt - now) / 1000));
}

/** `24:13`, or `1:02:00` past the hour. */
export function formatCountdown(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, '0') : String(minutes);
  const ss = String(seconds).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
