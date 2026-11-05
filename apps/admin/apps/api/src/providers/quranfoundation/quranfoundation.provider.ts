import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { fetchJson, ProviderHttpError } from '../fetch-json';
import { mapRiwaya } from '../riwaya-map';
import type {
  ProviderRelease,
  ProviderReleaseSummary,
  ReciterProvider,
} from '../provider.types';
import type {
  QfAudioResponse,
  QfChapterReciter,
  QfListResponse,
  QfTokenResponse,
} from './quranfoundation.types';

const CACHE_MS = 10 * 60 * 1000;

const HOSTS = {
  production: {
    auth: 'https://oauth2.quran.foundation',
    api: 'https://apis.quran.foundation',
  },
  prelive: {
    auth: 'https://prelive-oauth2.quran.foundation',
    api: 'https://apis-prelive.quran.foundation',
  },
} as const;

/**
 * Quran Foundation content API v4. Its chapter reciters are whole-surah
 * recordings; the ayah-by-ayah recitation ids are a different space and are
 * deliberately not used.
 *
 * Authentication is OAuth2 client credentials; the secret stays on this server.
 */
@Injectable()
export class QuranFoundationProvider implements ReciterProvider {
  readonly id = 'quranfoundation' as const;
  readonly label = 'Quran Foundation';

  private cache: { at: number; items: ProviderReleaseSummary[] } | null = null;
  private token: { value: string; expiresAt: number } | null = null;
  private tokenRequest: Promise<string> | null = null;

  constructor(private readonly config: ConfigService) {}

  private hosts(): { auth: string; api: string } {
    const env = this.config.get<string>('QURAN_FOUNDATION_ENV') === 'prelive' ? 'prelive' : 'production';
    return HOSTS[env];
  }

  private clientId(): string {
    const id = this.config.get<string>('QURAN_FOUNDATION_CLIENT_ID')?.trim();
    if (!id) throw new Error('Quran Foundation is not configured: QURAN_FOUNDATION_CLIENT_ID is empty');
    return id;
  }

  private async accessToken(force = false): Promise<string> {
    if (!force && this.token && Date.now() < this.token.expiresAt) return this.token.value;
    // Two locale calls start together on the first request; one token is enough.
    if (this.tokenRequest) return this.tokenRequest;

    const request = (async (): Promise<string> => {
      const secret = this.config.get<string>('QURAN_FOUNDATION_CLIENT_SECRET')?.trim();
      if (!secret) {
        throw new Error(
          'Quran Foundation is not configured: QURAN_FOUNDATION_CLIENT_SECRET is empty',
        );
      }

      const basic = Buffer.from(`${this.clientId()}:${secret}`).toString('base64');
      const body = await fetchJson<QfTokenResponse>(`${this.hosts().auth}/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'content' }),
      });

      // Re-request a minute before expiry; the token lives an hour.
      this.token = {
        value: body.access_token,
        expiresAt: Date.now() + Math.max(60, body.expires_in - 60) * 1000,
      };
      return this.token.value;
    })();

    this.tokenRequest = request;
    try {
      return await request;
    } finally {
      if (this.tokenRequest === request) this.tokenRequest = null;
    }
  }

  private async getJson<T>(path: string): Promise<T> {
    const request = async (force: boolean): Promise<T> => {
      const headers = {
        Accept: 'application/json',
        'x-auth-token': await this.accessToken(force),
        'x-client-id': this.clientId(),
      };
      return fetchJson<T>(`${this.hosts().api}/content/api/v4${path}`, { headers });
    };

    try {
      return await request(false);
    } catch (err) {
      if (err instanceof ProviderHttpError && err.status === 401) return request(true);
      throw err;
    }
  }

  private async list(): Promise<ProviderReleaseSummary[]> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.items;

    const [ar, en] = await Promise.all([
      this.getJson<QfListResponse>('/resources/chapter_reciters?language=ar'),
      this.getJson<QfListResponse>('/resources/chapter_reciters?language=en'),
    ]);

    const english = new Map<number, QfChapterReciter>(en.reciters.map((row) => [row.id, row]));
    const items: ProviderReleaseSummary[] = ar.reciters.map((row) => {
      const latin = english.get(row.id) ?? row;
      const arabic = row.translated_name?.name ?? row.name;
      return {
        provider: 'quranfoundation',
        reciterId: String(row.id),
        releaseId: String(row.id),
        variant: '',
        name: latin.name,
        nameAr: arabic,
        riwaya: mapRiwaya(latin.qirat?.name ?? row.qirat?.name),
        style: latin.style?.name ?? row.style?.name ?? null,
        surahCount: 114,
        sizeBytes: null,
      };
    });

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
    const summary = items.find((item) => item.releaseId === releaseId);
    if (!summary) {
      throw new Error(`Quran Foundation chapter reciter ${reciterId}/${releaseId} was not found`);
    }

    const body = await this.getJson<QfAudioResponse>(
      `/chapter_recitations/${encodeURIComponent(reciterId)}`,
    );

    const tracks = (body.audio_files ?? [])
      .map((file) => ({
        surah: Number(file.chapter_id),
        url: String(file.audio_url),
        sizeBytes: Number.isFinite(Number(file.file_size)) ? Math.round(Number(file.file_size)) : null,
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
