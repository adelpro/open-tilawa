/**
 * A slug per release, and the rules that keep it stable.
 *
 * The source is the torrent's own name, not the Arabic display name: it is already
 * ASCII, already unique per release, and already what the seeders call the folder.
 * Transliterating `محمد صديق المنشاوي` would invent a second spelling nobody agreed
 * on, and it would change the day someone edits `name_ar`.
 *
 * Identity stays the infohash. `slug` is the public face of it — assigned once, frozen
 * after that, and never derived again from a mutable field.
 */

/** Words a torrent name carries for its own purposes, not for a reader. */
const NOISE = new Set([
  'mp3',
  'quran',
  'qoran',
  'koran',
  'complete',
  'full',
  'update',
  'updated',
  'new',
  'hd',
  'high',
  'quality',
]);

/** `Maher_Al-Muaiqly_(Update2)_(MP3_Quran)` → `maher-al-muaiqly`. */
export function slugify(input: string): string {
  const words = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[()[\]]/g, ' ')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !NOISE.has(word) && !/^(update|part|cd|disc)\d*$/.test(word));

  return words.join('-').slice(0, 60).replace(/-+$/, '');
}

/**
 * `base`, then `base-riwaya`, then `base-<4 hex of the infohash>`.
 *
 * The riwaya distinguishes the three الحصري releases from each other in a way a reader
 * can check; the infohash prefix is the last resort for two releases of the same person
 * in the same reading, and being derived from the content hash means the same pair of
 * rows always resolves the same way.
 */
export function assignSlug(
  base: string,
  riwaya: string,
  infohash: string,
  taken: ReadonlySet<string>,
): string {
  const root = base || `release-${infohash.slice(0, 8).toLowerCase()}`;
  if (!taken.has(root)) return root;

  const reading = slugify(riwaya);
  const withRiwaya = reading && reading !== 'unknown' ? `${root}-${reading}` : '';
  if (withRiwaya && !taken.has(withRiwaya)) return withRiwaya;

  const stem = withRiwaya || root;
  const hash = infohash.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (let length = 4; length <= Math.max(hash.length, 4); length += 4) {
    const candidate = `${stem}-${hash.slice(0, length)}`;
    if (!taken.has(candidate)) return candidate;
  }

  // A hash collision here would mean the same content twice; row order is the only
  // remaining tiebreaker and it is stable for the life of the rows.
  let suffix = 2;
  while (taken.has(`${stem}-${suffix}`)) suffix += 1;
  return `${stem}-${suffix}`;
}
