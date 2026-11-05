import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { QuranFoundationProvider } from './quranfoundation.provider';

const config = {
  get: (key: string) => {
    if (key === 'QURAN_FOUNDATION_CLIENT_ID') return 'client';
    if (key === 'QURAN_FOUNDATION_CLIENT_SECRET') return 'secret';
    if (key === 'QURAN_FOUNDATION_ENV') return 'production';
    return undefined;
  },
} as unknown as ConfigService;

const ar = {
  reciters: [
    {
      id: 4,
      name: 'Abu Bakr al-Shatri',
      style: { name: 'مرتل' },
      qirat: { name: 'حفص' },
      translated_name: { name: 'أبو بكر الشاطرى' },
    },
  ],
};

const en = {
  reciters: [
    {
      id: 4,
      name: 'Abu Bakr al-Shatri',
      style: { name: 'Murattal' },
      qirat: { name: 'Hafs' },
      translated_name: { name: 'Abu Bakr al-Shatri' },
    },
  ],
};

const audio = {
  audio_files: [
    { id: 1, chapter_id: 1, file_size: 710784, format: 'mp3', audio_url: 'https://cdn.test/1.mp3' },
    { id: 2, chapter_id: 2, file_size: 1000, format: 'mp3', audio_url: 'https://cdn.test/2.mp3' },
  ],
};

const response = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
  text: async () => '',
});

describe('QuranFoundationProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exchanges a token and joins the two languages', async () => {
    const calls: string[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      calls.push(url);
      if (url.includes('/oauth2/token')) {
        return response({ access_token: 'token', expires_in: 3600 }) as unknown as Response;
      }
      return response(url.includes('language=ar') ? ar : en) as unknown as Response;
    });

    const provider = new QuranFoundationProvider(config);
    const results = await provider.search('');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: 'quranfoundation',
      reciterId: '4',
      releaseId: '4',
      name: 'Abu Bakr al-Shatri',
      nameAr: 'أبو بكر الشاطرى',
      riwaya: 'Hafs',
      style: 'Murattal',
    });
    expect(calls.filter((url) => url.includes('/oauth2/token'))).toHaveLength(1);
  });

  it('resolves chapter audio and sums the file sizes', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/oauth2/token')) {
        return response({ access_token: 'token', expires_in: 3600 }) as unknown as Response;
      }
      if (url.includes('/chapter_recitations/4')) return response(audio) as unknown as Response;
      return response(url.includes('language=ar') ? ar : en) as unknown as Response;
    });

    const provider = new QuranFoundationProvider(config);
    const release = await provider.release('4', '4');

    expect(release.tracks).toEqual([
      { surah: 1, url: 'https://cdn.test/1.mp3', sizeBytes: 710784 },
      { surah: 2, url: 'https://cdn.test/2.mp3', sizeBytes: 1000 },
    ]);
    expect(release.sizeBytes).toBe(711784);
  });

  it('re-requests the token once on a 401', async () => {
    let apiCalls = 0;
    let tokenCalls = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/oauth2/token')) {
        tokenCalls += 1;
        return response({ access_token: `token-${tokenCalls}`, expires_in: 3600 }) as unknown as Response;
      }
      apiCalls += 1;
      if (apiCalls === 1) return response({}, 401) as unknown as Response;
      return response(url.includes('language=ar') ? ar : en) as unknown as Response;
    });

    const provider = new QuranFoundationProvider(config);
    const results = await provider.search('');

    expect(results).toHaveLength(1);
    expect(tokenCalls).toBe(2);
  });
});
