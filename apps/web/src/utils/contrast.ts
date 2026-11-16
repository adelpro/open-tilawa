/**
 * The contrast decision, kept free of React and of storage.
 *
 * `prefers-contrast: more` is the operating system's own accessibility switch,
 * and it is the reason this feature has no configuration by default. The media
 * query lives here rather than in CSS so that an explicit choice can beat it:
 * a `@media` block cannot be turned off by a stylesheet rule without an undo
 * rule that fights the cascade for the rest of the file's life.
 *
 * Absent reads as `system` — the same convention `palette` uses, so a device
 * that never chose needs no migration and a new one needs no written default.
 */
export type Contrast = 'system' | 'more' | 'off';

export const CONTRASTS = ['system', 'more', 'off'] as const;

export function isContrast(value: unknown): value is Contrast {
  return typeof value === 'string' && (CONTRASTS as readonly string[]).includes(value);
}

/**
 * What the page should actually do. An explicit `more` or `off` wins; anything
 * else — `system`, absent, or a value written by a newer build — follows the OS.
 */
export function resolveContrast(stored: Contrast | undefined, prefersMore: boolean): 'more' | 'off' {
  if (stored === 'more') return 'more';
  if (stored === 'off') return 'off';
  return prefersMore ? 'more' : 'off';
}
