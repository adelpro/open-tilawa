/**
 * Rules for turning a downloaded reciter folder into a library entry.
 *
 * The payload that ships is the mushaf: 114 files numbered 001–114, nothing
 * else. Sources are not that tidy — one reciter arrived as
 * `ar_001_<reciter>.mp3`, another carried `MP3Quran.gif` and `MP3Quran.net.txt`
 * inside the torrent, which is 116 files for a 114-file book. Rebuilding the
 * torrent from a normalised folder is the only way to fix either without
 * leaving the node with a torrent it can never complete.
 *
 * Renaming does not re-download: the bytes are unchanged, so the node verifies
 * the new piece hashes against the files already on disk.
 */

const NUMBERED_LEADING = /^(\d{3})\.[^.]+$/;
const THREE_DIGITS = /\d{3}/g;

/**
 * The release name without the source's tags.
 *
 * `Maher_Al-Muaiqly_(MP3_Quran)` is a folder name from a download site, and the
 * parenthesised part is that site's metadata — it travels into the torrent name,
 * the magnet's `dn` and the web-seed URL, so a listener sees it everywhere.
 * `_Update2` is the same kind of residue: a re-release marker, not a name.
 */
export function cleanName(name) {
  const stripped = name
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/_?Update\d+/gi, '')
    .replace(/[_\s]{2,}/g, '_')
    .replace(/^[_\s]+|[_\s]+$/g, '');
  return stripped || name;
}

/** `001.mp3` and `ar_001_reciter.mp3` both name episode 1. */
export function episodeOf(name) {
  const leading = name.match(NUMBERED_LEADING);
  if (leading) return Number(leading[1]);
  const runs = name.match(THREE_DIGITS);
  if (!runs || runs.length === 0) return null;
  return Number(runs[0]);
}

const pad = (n) => String(n).padStart(3, '0');

/**
 * @param {string[]} names filenames inside one reciter folder (no paths)
 * @returns {{ok: true, rename: {from: string, to: string}[], drop: string[], count: number}
 *          | {ok: false, error: string}}
 */
export function planRename(names) {
  const drop = [];
  const byEpisode = new Map();

  for (const name of [...names].sort()) {
    if (!/\.mp3$/i.test(name)) {
      drop.push(name);
      continue;
    }
    const episode = episodeOf(name);
    if (episode === null) return { ok: false, error: `no episode number in "${name}"` };
    if (byEpisode.has(episode)) {
      return {
        ok: false,
        error: `episode ${pad(episode)} appears twice: "${byEpisode.get(episode)}" and "${name}"`,
      };
    }
    byEpisode.set(episode, name);
  }

  if (byEpisode.size === 0) return { ok: false, error: 'no mp3 files' };

  const episodes = [...byEpisode.keys()].sort((a, b) => a - b);
  for (let expected = 1; expected <= episodes.length; expected += 1) {
    if (episodes[expected - 1] !== expected) {
      return {
        ok: false,
        error: `episodes are not contiguous: expected ${pad(expected)}, found ${pad(episodes[expected - 1])}`,
      };
    }
  }

  const rename = episodes.map((episode) => ({
    from: byEpisode.get(episode),
    to: `${pad(episode)}.mp3`,
  }));

  return { ok: true, rename, drop, count: episodes.length };
}
