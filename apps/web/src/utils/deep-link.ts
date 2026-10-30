import { toPath, type Parsed } from '@/routes';
import type { Reciter } from '@/types';

/**
 * What a `/listen/<release>/<surah>` link means, decided against the catalogue.
 *
 * The surah number is the identity; the name beside it is decoration a link may get
 * wrong, and a wrong one becomes a redirect rather than a second URL for the same page.
 * A release with no slug yet resolves to `missing` — it has no link to open, and matching
 * on an empty string would put every slugless row at the same address.
 */
export type Resolution =
  | { kind: 'ok'; reciter: Reciter; surah: number }
  | { kind: 'moved'; to: string }
  | { kind: 'missing' };

export function resolveDeepLink(
  route: Extract<Parsed, { name: 'listen' }>,
  reciters: Reciter[],
): Resolution {
  const reciter = reciters.find((item) => item.slug !== '' && item.slug === route.release);
  if (!reciter) return { kind: 'missing' };

  const canonical = toPath({ name: 'listen', release: reciter.slug, surah: route.surah, surahName: '' });
  // The name segment only: `18-al-kahf` → `al-kahf`, so a link that omits the number or
  // writes an older spelling is compared on the part that can actually differ.
  const expectedName = (canonical.split('/').pop() ?? '').replace(/^\d+-/, '');
  if (route.surahName !== '' && route.surahName !== expectedName) return { kind: 'moved', to: canonical };

  return { kind: 'ok', reciter, surah: route.surah };
}
