/**
 * One formatter for every number the player reports.
 *
 * The player used to show `(bytes / 1024).toFixed(0) KB/s` in one place and a
 * KB/MB branch in another, so the same speed read differently in two spots.
 * Base 1024, units B → TB, and a rate is the same number with `/s`.
 */
const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

function scaled(bytes: number): { value: number; unit: string } {
  if (!Number.isFinite(bytes) || bytes <= 0) return { value: 0, unit: 'B' };
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  return { value: bytes / 1024 ** exponent, unit: UNITS[exponent] };
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return '—';
  if (bytes <= 0) return '0 B';
  const { value, unit } = scaled(bytes);
  const digits = value >= 10 || unit === 'B' ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`;
}

/** `formatSpeed(0)` is "0 B/s", not an em dash: a stalled transfer is a real speed. */
export function formatSpeed(bytesPerSecond: number | null | undefined): string {
  if (bytesPerSecond === null || bytesPerSecond === undefined) return '—';
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return '0 B/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}
