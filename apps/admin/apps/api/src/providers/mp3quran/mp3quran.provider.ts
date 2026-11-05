import { Injectable } from '@nestjs/common';
import { fetchJson } from '../fetch-json';
import { mapRiwaya } from '../riwaya-map';
import type {
  ProviderRelease,
  ProviderReleaseSummary,
  ReciterProvider,
} from '../provider.types';
import type { Mp3QuranMoshaf, Mp3QuranResponse } from './mp3quran.types';

const API = 'https://www.mp3quran.net/api/v3';
const CACHE_MS = 10 * 60 * 1000;

function styleOf(name: string): string | null {
  if (/mujawwad|مجوّد|مجود/i.test(name)) return 'Mujawwad';
  if (/murattal|مرتل/i.test(name)) return 'Murattal';
  return null;
}

function fileUrl(server: string, surah: number): string {
  const base = server.endsWith('/') ? server : `${server}/`;
  return `${base}${String(surah).padStart(3, '0')}.mp3`;
}

/**
 * MP3Quran v3: a person has one or more `moshaf` (a moshaf is the release),
 * each with a server directory and a surah list. There is no size in the API;
 * the seeder learns the real size after downloading.
 */
@Injectable()
export class Mp3QuranProvider implements ReciterProvider {
  readonly id = 'mp3quran' as const;
  readonly label = 'MP3Quran';

  private cache: { at: number; items: ProviderReleaseSummary[] } | null = null;
  private readonly moshafs = new Map<string, Mp3QuranMoshaf>();

  private async list(): Promise<ProviderReleaseSummary[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.items;

    const [ar, en] = await Promise.all([
      fetchJson<Mp3QuranResponse>(`${API}/reciters?language=ar`),
      fetchJson<Mp3QuranResponse>(`${API}/reciters?language=eng`),
    ]);

    const english = new Map(en.reciters.map((row) => [row.id, row]));
    const items: ProviderReleaseSummary[] = [];
    this.moshafs.clear();

    for (const row of ar.reciters) {
      const latin = english.get(row.id) ?? row;
      for (const moshaf of row.moshaf ?? []) {
        const latinMoshaf = latin.moshaf?.find((entry) => entry.id === moshaf.id) ?? moshaf;
        const name = `${row.id}:${moshaf.id}`;
        this.moshafs.set(name, moshaf);
        items.push({
          provider: 'mp3quran',
          reciterId: String(row.id),
          releaseId: String(moshaf.id),
          variant: '',
          name: latin.name,
          nameAr: row.name,
          riwaya: mapRiwaya(latinMoshaf.name ?? moshaf.name),
          style: styleOf(latinMoshaf.name ?? moshaf.name),
          surahCount: moshaf.surah_total,
          sizeBytes: null,
        });
      }
    }

    this.cache = { at: Date.now(), items };
    return items;
  }

  async search(query: string): Promise<ProviderReleaseSummary[]> {
    const items = await this.list();
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 1000);
    return items
      .filter((item) =>
        [item.name, item.nameAr ?? '', item.riwaya, item.style ?? '']
          .join(' ')
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 1000);
  }

  async release(reciterId: string, releaseId: string): Promise<ProviderRelease> {
    const items = await this.list();
    const summary = items.find(
      (item) => item.reciterId === reciterId && item.releaseId === releaseId,
    );
    if (!summary) throw new Error(`MP3Quran release ${reciterId}/${releaseId} was not found`);

    const moshaf = this.moshafs.get(`${reciterId}:${releaseId}`);
    if (!moshaf) throw new Error(`MP3Quran moshaf ${reciterId}/${releaseId} was not loaded`);

    const surahs = moshaf.surah_list
      .split(',')
      .map((entry) => Number(entry.trim()))
      .filter((entry) => Number.isInteger(entry) && entry >= 1 && entry <= 114);

    const tracks = surahs.map((surah) => ({
      surah,
      url: fileUrl(moshaf.server, surah),
      sizeBytes: null,
    }));

    return { ...summary, surahCount: tracks.length, tracks };
  }
}
