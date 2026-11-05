import { describe, expect, it, jest } from '@jest/globals';
import { LinkSuggestionsService } from './link-suggestions.service';
import type { ProviderReleaseSummary } from './provider.types';
import type { Reciter } from '../reciters/reciters.service';
import type { RecitersService } from '../reciters/reciters.service';
import type { ProviderRegistry } from './provider.registry';

const row = (overrides: Partial<Reciter>): Reciter =>
  ({
    id: 1,
    name: 'Release',
    nameAr: null,
    riwaya: 'Hafs',
    infohash: '',
    magnet: '',
    fileCount: 114,
    sizeBytes: null,
    published: false,
    slug: 'release',
    createdAt: '',
    provider: null,
    reciterId: null,
    releaseId: null,
    variant: null,
    importState: null,
    importProgress: 0,
    importError: null,
    importPublish: false,
    importSeederId: null,
    importFolder: null,
    ...overrides,
  }) as Reciter;

const release = (
  releaseId: string,
  style: string | null,
): ProviderReleaseSummary => ({
  provider: 'mp3quran',
  reciterId: '51',
  releaseId,
  variant: '',
  name: 'Abdulbasit Abdulsamad',
  nameAr: 'عبد الباسط عبد الصمد',
  riwaya: 'Hafs',
  style,
  surahCount: 114,
  sizeBytes: null,
});

describe('LinkSuggestionsService', () => {
  const rows = [
    row({
      id: 1,
      name: 'Abdulbasit_Abdulsamad_Mojawwad',
      nameAr: 'عبد الباسط عبد الصمد (مجوّد)',
    }),
    row({
      id: 2,
      name: 'Abdulbasit_Abdulsamad_Murattal',
      provider: 'mp3quran',
      reciterId: '51',
      releaseId: '53',
      variant: null,
    }),
  ];

  const linkProvider = jest.fn().mockReturnValue(rows[0]);
  const reciters = {
    list: () => rows,
    linkProvider,
  } as unknown as RecitersService;

  const candidates = [
    release('53', 'Mujawwad'), // already used by row 2
    release('51', 'Mujawwad'),
    release('52', 'Murattal'),
  ];
  const registry = {
    list: () => [{ id: 'mp3quran', label: 'MP3Quran' }],
    get: () => ({ search: async () => candidates }),
  } as unknown as ProviderRegistry;

  const service = new LinkSuggestionsService(reciters, registry);

  it('excludes releases another row already carries and prefers the matching style', async () => {
    const [suggestion] = await service.suggestions();
    expect(suggestion.candidates.map((candidate) => candidate.releaseId)).toEqual(['51', '52']);
    expect(suggestion.candidates[0].score).toBeGreaterThan(suggestion.candidates[1].score);
  });

  it('refuses a release already linked to another row with a readable message', () => {
    expect(() =>
      service.link({
        rowId: 1,
        provider: 'mp3quran',
        reciterId: '51',
        releaseId: '53',
        variant: '',
      }),
    ).toThrow(/already linked/);
    expect(linkProvider).not.toHaveBeenCalled();
  });

  it('writes one provider link', () => {
    service.link({
      rowId: 1,
      provider: 'mp3quran',
      reciterId: '51',
      releaseId: '51',
      variant: '',
    });
    expect(linkProvider).toHaveBeenCalledWith(1, {
      provider: 'mp3quran',
      reciterId: '51',
      releaseId: '51',
      variant: '',
    });
  });

  it('refuses an empty release id', () => {
    expect(() =>
      service.link({ rowId: 1, provider: 'mp3quran', reciterId: '51', releaseId: ' ' }),
    ).toThrow(/choose a provider release/);
  });
});
