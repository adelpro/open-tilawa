import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { ItqanProvider } from './itqan.provider';

const config = {
  get: (key: string) => (key === 'ITQAN_API_KEY' ? 'secret' : undefined),
} as unknown as ConfigService;

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => '',
});

const ar = {
  count: 1,
  results: [
    {
      id: 11,
      name: 'مصحف القارئ بدر التركي',
      reciter: { id: 2, name: 'بدر التركي' },
      riwayah: { id: 10, name: 'حفص عن عاصم' },
      surahs_count: 114,
      folders: [
        { name: 'default', slug: 'default', is_default: true },
        { name: 'with FX', slug: 'with-fx', is_default: false },
      ],
    },
  ],
};

const en = {
  count: 1,
  results: [
    {
      id: 11,
      name: 'Badr Al-Turki Recitation',
      reciter: { id: 2, name: 'Badr Al-Turki' },
      riwayah: { id: 10, name: 'Hafs an Aasim' },
      surahs_count: 114,
      folders: [{ name: 'default', slug: 'default', is_default: true }],
    },
  ],
};

const detail = {
  count: 2,
  results: [
    { surah_number: 1, audio_url: 'https://cdn.test/001.mp3', size_bytes: 100 },
    { surah_number: 2, audio_url: 'https://cdn.test/002.mp3', size_bytes: 200 },
  ],
};

describe('ItqanProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('joins the two locales and lists one summary per folder', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (_input, init) => {
      const language = new Headers(init?.headers as Record<string, string>).get('Accept-Language');
      if (language === 'ar') return response(ar) as unknown as Response;
      if (language === 'en') return response(en) as unknown as Response;
      return response(detail) as unknown as Response;
    });

    const provider = new ItqanProvider(config);
    const results = await provider.search('');

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      provider: 'itqan',
      reciterId: '2',
      releaseId: '11',
      name: 'Badr Al-Turki',
      nameAr: 'بدر التركي',
      riwaya: 'Hafs',
      variant: 'default',
    });
    expect(results[1].variant).toBe('with-fx');
  });

  it('resolves a release into tracks and sums the sizes', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const language = new Headers(init?.headers as Record<string, string>).get('Accept-Language');
      if (url.includes('/recitations/11/')) {
        if (url.includes('folder=default')) return response(detail) as unknown as Response;
        return response({ count: 0, results: [] }) as unknown as Response;
      }
      if (language === 'ar') return response(ar) as unknown as Response;
      return response(en) as unknown as Response;
    });

    const provider = new ItqanProvider(config);
    const release = await provider.release('2', '11', 'default');

    expect(release.tracks).toEqual([
      { surah: 1, url: 'https://cdn.test/001.mp3', sizeBytes: 100 },
      { surah: 2, url: 'https://cdn.test/002.mp3', sizeBytes: 200 },
    ]);
    expect(release.sizeBytes).toBe(300);
    expect(release.surahCount).toBe(2);
  });
});
