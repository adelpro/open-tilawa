import { describe, expect, it } from '@jest/globals';
import { magnetForInfo, mergeTrackers } from '../src/settings/settings.service';

/**
 * A magnet is consumed by magnet-uri / parse-torrent, which split on `&` and
 * `=` and do **not** percent-decode values. A magnet built with
 * `URLSearchParams.toString()` therefore hands the player
 * `xt=urn%3Abtih%3A…`, and parse-torrent answers "Invalid torrent identifier".
 *
 * These tests pin the wire format the player can actually read.
 */

const HASH = '012101c66ee42d7c5905ab910e2b129335f4f30d';
const TRACKER = 'wss://tracker.quran.us.kg';

/** The xt the player parses: `urn:btih:` must survive as literal characters. */
function xtOf(magnet: string): string | null {
  const match = magnet.match(/[?&]xt=([^&]*)/);
  return match ? match[1] : null;
}

describe('magnet wire format', () => {
  it('magnetForInfo writes a literal urn:btih and literal tracker URLs', () => {
    const magnet = magnetForInfo(HASH, 'Saad_Alghamdi', [TRACKER]);
    expect(xtOf(magnet)).toBe(`urn:btih:${HASH}`);
    expect(magnet).toContain(`tr=${TRACKER}`);
    expect(magnet).not.toContain('%3A');
    expect(magnet).not.toContain('%2F');
  });

  it('mergeTrackers keeps an existing hash literal and merges trackers', () => {
    const magnet = mergeTrackers(
      `magnet:?xt=urn:btih:${HASH}&dn=Saad_Alghamdi&tr=wss://tracker.btorrent.xyz`,
      [TRACKER],
    );
    expect(xtOf(magnet)).toBe(`urn:btih:${HASH}`);
    expect(magnet).toContain('tr=wss://tracker.btorrent.xyz');
    expect(magnet).toContain(`tr=${TRACKER}`);
    expect(magnet).not.toContain('%3A');
  });

  it('mergeTrackers decodes a magnet that was already over-encoded', () => {
    // Exactly what this bug wrote into the database.
    const broken = `magnet:?xt=urn%3Abtih%3A${HASH}&dn=A&tr=wss%3A%2F%2Ftracker.quran.us.kg`;
    const magnet = mergeTrackers(broken, [TRACKER]);
    expect(xtOf(magnet)).toBe(`urn:btih:${HASH}`);
    expect(magnet).toContain(`tr=${TRACKER}`);
  });

  it('keeps web seeds (ws=) and other parameters it does not own', () => {
    const magnet = mergeTrackers(
      `magnet:?xt=urn:btih:${HASH}&dn=A&ws=https://archive.org/download/x/&xl=123`,
      [TRACKER],
    );
    expect(magnet).toContain('ws=https://archive.org/download/x/');
    expect(magnet).toContain('xl=123');
  });

  it('leaves a non-magnet string alone', () => {
    expect(mergeTrackers('https://example.org/x.torrent', [TRACKER])).toBe(
      'https://example.org/x.torrent',
    );
  });
});
