import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { Mp3QuranProvider } from './mp3quran.provider';

const ar = {
  reciters: [
    {
      id: 1,
      name: 'ماهر المعيقلي',
      moshaf: [
        {
          id: 1,
          name: 'حفص عن عاصم - مرتل',
          server: 'https://cdn.test/maher/',
          surah_total: 3,
          surah_list: '1,2,3',
        },
      ],
    },
  ],
};

const en = {
  reciters: [
    {
      id: 1,
      name: 'Maher Al-Muaiqly',
      moshaf: [
        {
          id: 1,
          name: "Rewayat Hafs A'n Assem - Murattal",
          server: 'https://cdn.test/maher/',
          surah_total: 3,
          surah_list: '1,2,3',
        },
      ],
    },
  ],
};

const response = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => '',
});

describe('Mp3QuranProvider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('joins the two locales and maps the moshaf', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return response(url.includes('language=ar') ? ar : en) as unknown as Response;
    });

    const provider = new Mp3QuranProvider();
    const results = await provider.search('maher');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: 'mp3quran',
      reciterId: '1',
      releaseId: '1',
      name: 'Maher Al-Muaiqly',
      nameAr: 'ماهر المعيقلي',
      riwaya: 'Hafs',
      style: 'Murattal',
      surahCount: 3,
      sizeBytes: null,
    });
  });

  it('builds track URLs from the server and the surah list', async () => {
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return response(url.includes('language=ar') ? ar : en) as unknown as Response;
    });

    const provider = new Mp3QuranProvider();
    const release = await provider.release('1', '1');

    expect(release.tracks).toEqual([
      { surah: 1, url: 'https://cdn.test/maher/001.mp3', sizeBytes: null },
      { surah: 2, url: 'https://cdn.test/maher/002.mp3', sizeBytes: null },
      { surah: 3, url: 'https://cdn.test/maher/003.mp3', sizeBytes: null },
    ]);
  });

  it('recognises the Mojawwad spelling MP3Quran uses', async () => {
    const ar2 = {
      reciters: [
        {
          id: 51,
          name: 'عبد الباسط عبد الصمد',
          moshaf: [
            {
              id: 51,
              name: 'حفص عن عاصم - المصحف المجود',
              server: 'https://cdn.test/basit/',
              surah_total: 1,
              surah_list: '1',
            },
          ],
        },
      ],
    };
    const en2 = {
      reciters: [
        {
          id: 51,
          name: 'Abdulbasit Abdulsamad',
          moshaf: [
            {
              id: 51,
              name: "Rewayat Hafs A'n Assem - Almusshaf Al Mojawwad",
              server: 'https://cdn.test/basit/',
              surah_total: 1,
              surah_list: '1',
            },
          ],
        },
      ],
    };
    jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      return response(url.includes('language=ar') ? ar2 : en2) as unknown as Response;
    });

    const results = await new Mp3QuranProvider().search('');
    expect(results[0].style).toBe('Mujawwad');
  });
});
