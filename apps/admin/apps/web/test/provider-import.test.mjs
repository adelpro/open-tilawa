import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyProviderRelease,
  folderFromRelease,
  importPayload,
} from '../src/lib/provider-import.ts';

const release = {
  provider: 'itqan',
  reciterId: '2',
  releaseId: '11',
  variant: 'default',
  name: 'Badr Al-Turki',
  nameAr: 'بدر التركي',
  riwaya: 'Hafs',
  style: null,
  surahCount: 114,
  sizeBytes: 1073741824,
};

describe('provider import form', () => {
  it('fills only the fields a provider knows, never the torrent identity', () => {
    const filled = applyProviderRelease(release);
    assert.deepEqual(filled, {
      name: 'Badr Al-Turki',
      nameAr: 'بدر التركي',
      riwaya: 'Hafs',
      fileCount: '114',
      sizeGb: '1.00',
      provider: 'itqan',
      reciterId: '2',
      releaseId: '11',
      variant: 'default',
    });
    assert.equal('infohash' in filled, false);
    assert.equal('magnet' in filled, false);
  });

  it('builds a folder name the seeder accepts', () => {
    assert.equal(folderFromRelease(release), 'Badr_Al-Turki_Hafs');
    assert.equal(
      folderFromRelease({ ...release, name: "Abdul Basit (Mujawwad)", riwaya: 'unknown' }),
      'Abdul_Basit_Mujawwad',
    );
  });

  it('builds the import payload without torrent fields', () => {
    assert.deepEqual(importPayload(release, 'Badr_Al-Turki_Hafs', [3, 4], true), {
      provider: 'itqan',
      reciterId: '2',
      releaseId: '11',
      variant: 'default',
      seederIds: [3, 4],
      folderName: 'Badr_Al-Turki_Hafs',
      publish: true,
    });
  });
});
