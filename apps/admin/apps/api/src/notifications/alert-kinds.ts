/**
 * The alert kinds, in one place.
 *
 * The settings service validates against this list and the rules engine switches
 * on it, so a second literal would let the console save a kind nothing evaluates.
 */
export const ALERT_KINDS = [
  'service.down',
  'seeder.offline',
  'seeder.disk',
  'seeder.update_failed',
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

export function isAlertKind(value: unknown): value is AlertKind {
  return typeof value === 'string' && (ALERT_KINDS as readonly string[]).includes(value);
}
