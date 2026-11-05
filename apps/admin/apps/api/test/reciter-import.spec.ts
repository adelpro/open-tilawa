import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { bootHarness, type Harness } from './harness';
import { ReciterImportService } from '../src/reciters/reciter-import.service';
import { RecitersService } from '../src/reciters/reciters.service';
import { SeedersService } from '../src/seeders/seeders.service';
import { ProviderRegistry } from '../src/providers/provider.registry';
import type { ProviderRelease } from '../src/providers/provider.types';

const HASH = 'c'.repeat(40);

function release(reciterId: string, releaseId: string): ProviderRelease {
  return {
    provider: 'itqan',
    reciterId,
    releaseId,
    variant: 'default',
    name: 'Badr Al-Turki',
    nameAr: 'بدر التركي',
    riwaya: 'Hafs',
    style: null,
    surahCount: 114,
    sizeBytes: 114_000,
    tracks: Array.from({ length: 114 }, (_, index) => ({
      surah: index + 1,
      url: `https://example.test/${index + 1}.mp3`,
      sizeBytes: 1_000,
    })),
  };
}

describe('reciter provider import', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await bootHarness();
  });
  afterAll(async () => {
    await h.close();
  });

  it('creates a draft, starts the node job, then fills the torrent on done', async () => {
    const imports = h.app.get(ReciterImportService);
    const reciters = h.app.get(RecitersService);
    const seeders = h.app.get(SeedersService);
    const registry = h.app.get(ProviderRegistry);

    jest.spyOn(registry, 'get').mockReturnValue({
      id: 'itqan',
      label: 'Itqan',
      search: async () => [],
      release: async () => release('2', '11'),
    });
    const started = jest
      .spyOn(seeders, 'importRelease')
      .mockResolvedValue({ jobId: 'job-1' });
    jest.spyOn(seeders, 'importStatus').mockResolvedValue({
      state: 'done',
      done: 114,
      total: 114,
      bytes: 114_000,
      error: null,
      result: {
        infohash: HASH,
        magnet: `magnet:?xt=urn:btih:${HASH}`,
        sizeBytes: 114_000,
        fileCount: 114,
      },
    });

    const row = await imports.start({
      provider: 'itqan',
      reciterId: '2',
      releaseId: '11',
      seederIds: [7],
      folderName: 'Badr_Al-Turki_Hafs',
      publish: true,
    });

    expect(started).toHaveBeenCalledWith(7, {
      folderName: 'Badr_Al-Turki_Hafs',
      name: 'Badr_Al-Turki_Hafs',
      tracks: expect.any(Array),
    });
    expect(row.importState).toBe('downloading');
    expect(row.published).toBe(false);
    expect(row.provider).toBe('itqan');

    await imports.poll();

    const done = reciters.get(row.id)!;
    expect(done.infohash).toBe(HASH);
    expect(done.magnet).toBe(`magnet:?xt=urn:btih:${HASH}`);
    expect(done.published).toBe(true);
    expect(done.importState).toBeNull();
    expect(done.fileCount).toBe(114);
  });

  it('accepts a partial release, keeping its real track count', async () => {
    const imports = h.app.get(ReciterImportService);
    const registry = h.app.get(ProviderRegistry);
    const short = release('3', '12');
    short.tracks = short.tracks.slice(0, 16);
    short.surahCount = 16;
    jest.spyOn(registry, 'get').mockReturnValue({
      id: 'itqan',
      label: 'Itqan',
      search: async () => [],
      release: async () => short,
    });

    const row = await imports.start({
      provider: 'itqan',
      reciterId: '3',
      releaseId: '12',
      seederIds: [7],
      folderName: 'Short_Hafs',
      publish: false,
    });

    expect(row.fileCount).toBe(16);
    expect(row.importState).toBe('downloading');
  });

  it('starts the import on every selected node and tracks the first success', async () => {
    const imports = h.app.get(ReciterImportService);
    const seeders = h.app.get(SeedersService);
    const registry = h.app.get(ProviderRegistry);
    jest.spyOn(registry, 'get').mockReturnValue({
      id: 'itqan',
      label: 'Itqan',
      search: async () => [],
      release: async () => release('4', '14'),
    });
    const started = jest.spyOn(seeders, 'importRelease');
    started.mockReset();
    started
      .mockResolvedValueOnce({ jobId: 'job-a' })
      .mockResolvedValueOnce({ jobId: 'job-b' });

    const row = await imports.start({
      provider: 'itqan',
      reciterId: '4',
      releaseId: '14',
      seederIds: [7, 8],
      folderName: 'Multi_Hafs',
      publish: false,
    });

    expect(started).toHaveBeenCalledTimes(2);
    expect(started).toHaveBeenNthCalledWith(1, 7, expect.any(Object));
    expect(started).toHaveBeenNthCalledWith(2, 8, expect.any(Object));
    expect(row.importSeederId).toBe(7);
  });

  it('refuses a duplicate provider release', async () => {
    const imports = h.app.get(ReciterImportService);
    const registry = h.app.get(ProviderRegistry);
    jest.spyOn(registry, 'get').mockReturnValue({
      id: 'itqan',
      label: 'Itqan',
      search: async () => [],
      release: async () => release('2', '11'),
    });

    await expect(
      imports.start({
        provider: 'itqan',
        reciterId: '2',
        releaseId: '11',
        seederId: 7,
        folderName: 'Again_Hafs',
      }),
    ).rejects.toThrow(/already linked/);
  });
});
