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

/**
 * The effect's whole decision, in one place.
 *
 * `applied` is the canonical link already honoured this mount. It is compared
 * *before* resolving, but it is only ever written by an `apply`: `toPath` writes
 * the canonical surah name, so a stale link and its redirect target share the
 * same href. Recording the href on `moved` made the canonical pass look like a
 * repeat, the reciter was never selected, and the player sat with no source —
 * the defect this type exists to keep out.
 */
export type DeepLinkPlan =
  | { kind: 'skip' }
  | { kind: 'missing' }
  | { kind: 'moved' }
  | { kind: 'apply'; reciter: Reciter; surah: number; href: string };

export function planDeepLink(
  route: Extract<Parsed, { name: 'listen' }>,
  reciters: Reciter[],
  applied: string,
): DeepLinkPlan {
  const href = toPath(route);
  if (applied === href) return { kind: 'skip' };

  const resolution = resolveDeepLink(route, reciters);
  if (resolution.kind === 'missing') return { kind: 'missing' };
  if (resolution.kind === 'moved') return { kind: 'moved' };

  return { kind: 'apply', reciter: resolution.reciter, surah: resolution.surah, href };
}

export function resolveDeepLink(
  route: Extract<Parsed, { name: 'listen' }>,
  reciters: Reciter[],
): Resolution {
  const reciter = reciters.find((item) => item.slug !== '' && item.slug === route.release);
  if (!reciter) return { kind: 'missing' };

  // A partial release has no file behind a surah it does not carry: that link is
  // a dead player with no source, so it is missing rather than a page. A null
  // manifest is "unknown" and refuses nothing.
  if (reciter.surahs && reciter.surahs.length > 0 && !reciter.surahs.includes(route.surah)) {
    return { kind: 'missing' };
  }

  const canonical = toPath({ name: 'listen', release: reciter.slug, surah: route.surah, surahName: '' });
  // The name segment only: `18-al-kahf` → `al-kahf`, so a link that omits the number or
  // writes an older spelling is compared on the part that can actually differ.
  const expectedName = (canonical.split('/').pop() ?? '').replace(/^\d+-/, '');
  if (route.surahName !== '' && route.surahName !== expectedName) return { kind: 'moved', to: canonical };

  return { kind: 'ok', reciter, surah: route.surah };
}
