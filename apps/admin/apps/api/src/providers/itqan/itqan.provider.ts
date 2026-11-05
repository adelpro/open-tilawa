import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson } from '../fetch-json';
import { mapRiwaya } from '../riwaya-map';
import type {
  ProviderRelease,
  ProviderReleaseSummary,
  ReciterProvider,
} from '../provider.types';
import type { ItqanDetailResponse, ItqanListResponse, ItqanRecitation } from './itqan.types';

const API = 'https://api.cms.itqan.dev';
const CACHE_MS = 10 * 60 * 1000;

/**
 * Itqan CMS: one recitation per recording, with a folder variant (`default`,
 * `with-fx`). The list endpoint carries Arabic and English in two locales, so
 * both are fetched and joined by recitation id; a row needs both names.
 */
@Injectable()
export class ItqanProvider implements ReciterProvider {
  readonly id = 'itqan' as const;
  readonly label = 'Itqan';

  private cache: { at: number; items: ProviderReleaseSummary[] } | null = null;

  constructor(private readonly config: ConfigService) {}

  private headers(language: 'ar' | 'en'): Record<string, string> {
    const key = this.config.get<string>('ITQAN_API_KEY')?.trim();
    return {
      Accept: 'application/json',
      'Accept-Language': language,
      'X-Client-Name': 'open-tilawa',
      'X-Client-Version': this.config.get<string>('APP_VERSION') ?? '1.33.9',
      ...(key ? { 'X-API-Key': key } : {}),
    };
  }

  private async list(): Promise<ProviderReleaseSummary[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.items;

    const [ar, en, arabicReciters] = await Promise.all([
      fetchJson<ItqanListResponse>(`${API}/recitations/?page_size=100`, {
        headers: this.headers('ar'),
      }),
      fetchJson<ItqanListResponse>(`${API}/recitations/?page_size=100`, {
        headers: this.headers('en'),
      }),
      fetchJson<{ results: { id: number; name: string }[] }>(
        `${API}/reciters/?page_size=100`,
        { headers: this.headers('ar') },
      ),
    ]);

    const english = new Map<number, ItqanRecitation>(en.results.map((row) => [row.id, row]));
    const arabicNames = new Map<number, string>(
      (arabicReciters.results ?? []).map((row) => [row.id, row.name]),
    );
    const items: ProviderReleaseSummary[] = [];

    for (const row of ar.results) {
      const latin = english.get(row.id) ?? row;
      const riwaya = mapRiwaya(latin.riwayah?.name ?? row.riwayah?.name);
      const folders =
        row.folders && row.folders.length > 0
          ? row.folders
          : [{ name: 'default', slug: 'default', is_default: true }];

      for (const folder of folders) {
        items.push({
          provider: 'itqan',
          reciterId: String(row.reciter.id),
          releaseId: String(row.id),
          variant: folder.slug,
          name: latin.reciter.name,
          nameAr: arabicNames.get(row.reciter.id) ?? row.reciter.name,
          riwaya,
          style: null,
          surahCount: row.surahs_count,
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

  async release(
    reciterId: string,
    releaseId: string,
    variant = 'default',
  ): Promise<ProviderRelease> {
    const items = await this.list();
    const summary =
      items.find(
        (item) =>
          item.reciterId === reciterId &&
          item.releaseId === releaseId &&
          item.variant === (variant || 'default'),
      ) ??
      items.find((item) => item.releaseId === releaseId && item.variant === (variant || 'default'));
    if (!summary) throw new Error(`Itqan release ${reciterId}/${releaseId} was not found`);

    const detail = await fetchJson<ItqanDetailResponse>(
      `${API}/recitations/${encodeURIComponent(releaseId)}/?page_size=1000&folder=${encodeURIComponent(
        variant || 'default',
      )}`,
      { headers: this.headers('ar') },
    );

    const tracks = (detail.results ?? [])
      .map((track) => ({
        surah: Number(track.surah_number),
        url: String(track.audio_url),
        sizeBytes: Number.isFinite(Number(track.size_bytes)) ? Number(track.size_bytes) : null,
      }))
      .sort((a, b) => a.surah - b.surah);

    const size = tracks.reduce((total, track) => total + (track.sizeBytes ?? 0), 0);
    return {
      ...summary,
      surahCount: tracks.length,
      sizeBytes: size > 0 ? size : null,
      tracks,
    };
  }
}
