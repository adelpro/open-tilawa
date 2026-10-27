import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { bootHarness, type Harness } from './harness';
import { RecitersService } from '../src/reciters/reciters.service';

const HAFS = '5e0becf35d91ea4602f04db90d74621a172aa396';
const WARSH = '012101c66ee42d7c5905ab910e2b129335f4f30d';
const magnet = (hash: string) => `magnet:?xt=urn:btih:${hash}&dn=x`;

describe('public reciter catalogue', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await bootHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('returns published rows only, with id and riwaya untouched', async () => {
    const service = h.app.get(RecitersService);
    const shown = service.add({
      name: 'Maher',
      nameAr: 'ماهر',
      riwaya: 'Hafs',
      infohash: HAFS,
      magnet: magnet(HAFS),
      fileCount: 114,
    });
    service.add({
      name: 'Yassine',
      riwaya: 'Warsh',
      infohash: WARSH,
      magnet: magnet(WARSH),
      fileCount: 114,
      published: false,
    });

    const res = await request(h.app.getHttpServer()).get('/api/public/reciters').expect(200);

    expect(res.body.reciters).toHaveLength(1);
    expect(res.body.reciters[0].id).toBe(shown.id);
    expect(res.body.reciters[0].riwaya).toBe('Hafs');
    expect(res.body.reciters[0].nameAr).toBe('ماهر');
  });

  it('keeps an unknown riwaya as unknown', async () => {
    const service = h.app.get(RecitersService);
    const hash = 'f'.repeat(40);
    const row = service.add({
      name: 'Unknown',
      riwaya: 'unknown',
      infohash: hash,
      magnet: magnet(hash),
      fileCount: 114,
    });
    const res = await request(h.app.getHttpServer()).get('/api/public/reciters').expect(200);
    expect(res.body.reciters.find((r: { id: number }) => r.id === row.id).riwaya).toBe('unknown');
  });

  it('hides a row when published flips to false', async () => {
    const service = h.app.get(RecitersService);
    const hash = 'a'.repeat(40);
    const row = service.add({
      name: 'Temp',
      riwaya: 'Hafs',
      infohash: hash,
      magnet: magnet(hash),
      fileCount: 114,
    });
    service.update(row.id, { published: false });
    const res = await request(h.app.getHttpServer()).get('/api/public/reciters').expect(200);
    expect(res.body.reciters.some((r: { id: number }) => r.id === row.id)).toBe(false);
  });
});
