import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sameRelease } from '../src/utils/release.ts';

/** The catalogue writes a literal `urn:btih:`; a normalised magnet writes `%3A`. */
const magnet = (hash: string, extra = '') => `magnet:?xt=urn:btih:${hash}${extra}`;

const SABER = '8f7d9f4dcdde90177b90c8ee362fe90cee58da56';
const YASSINE = '815cc72f6059df79533d885d42fab32475010c66';

describe('sameRelease', () => {
  it('matches the same infohash with different names and trackers', () => {
    const a = magnet(SABER, '&dn=Saber_Abdulhakam_Warsh');
    const b = magnet(SABER.toUpperCase(), '&dn=Saber&tr=wss%3A%2F%2Ftracker.tilawah.cc');
    assert.equal(sameRelease(a, b), true);
  });

  it('matches a percent-encoded btih, which the catalogue also ships', () => {
    const encoded = `magnet:?xt=urn%3Abtih%3A${SABER}&dn=Saber`;
    assert.equal(sameRelease(encoded, magnet(SABER)), true);
  });

  it('separates two reciters', () => {
    assert.equal(sameRelease(magnet(SABER), magnet(YASSINE)), false);
  });

  it('is false when either side is missing or is not a magnet', () => {
    assert.equal(sameRelease(undefined, magnet(SABER)), false);
    assert.equal(sameRelease(magnet(SABER), ''), false);
    assert.equal(sameRelease('https://tilawah.cc/', magnet(SABER)), false);
    assert.equal(sameRelease(magnet('not-a-hash'), magnet(SABER)), false);
  });
});
