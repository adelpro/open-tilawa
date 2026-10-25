import { MagnetlinkSource, Reciter, ReciterTag } from '@/types';

/**
 * Derive capability tags from a reciter's magnet + source.
 * Single source of truth so filters/badges never drift from data.
 */
export function deriveTags(reciter: Reciter): ReciterTag[] {
  const tags: Set<ReciterTag> = new Set(['p2p', 'mp3']);
  const magnet = reciter.magnet || '';
  const hasWs = /[?&]ws=/.test(magnet);
  if (hasWs) {
    tags.add('web-seed');
    tags.add('http-fallback');
  } else {
    tags.add('p2p-only');
  }
  switch (reciter.source) {
    case MagnetlinkSource.INTERNETARCHIVE:
      tags.add('archive.org');
      break;
    case MagnetlinkSource.MP3QURAN:
      tags.add('mp3quran.net');
      break;
    case MagnetlinkSource.ISLAMHOUSE:
      tags.add('islamhouse.com');
      break;
  }
  return Array.from(tags);
}
