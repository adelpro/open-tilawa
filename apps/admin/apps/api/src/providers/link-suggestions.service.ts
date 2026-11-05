import { Injectable } from '@nestjs/common';
import { RecitersService } from '../reciters/reciters.service';
import { ProviderRegistry } from './provider.registry';
import type { ProviderId, ProviderReleaseSummary } from './provider.types';

export interface LinkSuggestion {
  rowId: number;
  name: string;
  nameAr: string | null;
  riwaya: string;
  candidates: (ProviderReleaseSummary & { score: number })[];
}

/** Lowercase, no diacritics, no punctuation, no style suffix. */
function compact(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function styleHint(row: { name: string; nameAr: string | null }): 'Mujawwad' | 'Murattal' | null {
  const text = `${row.name} ${row.nameAr ?? ''}`.toLowerCase();
  if (/mujawwad|mojawwad|مجوّد|مجود/.test(text)) return 'Mujawwad';
  if (/murattal|مرتل/.test(text)) return 'Murattal';
  return null;
}

function scoreOne(row: { name: string; nameAr: string | null; riwaya: string }, candidate: ProviderReleaseSummary): number {
  const rowAr = compact(row.nameAr);
  const rowEn = compact(row.name);
  const candidateAr = compact(candidate.nameAr);
  const candidateEn = compact(candidate.name);

  let score = 0;
  if (rowAr && candidateAr && rowAr === candidateAr) score = 100;
  else if (rowEn && candidateEn && rowEn === candidateEn) score = 90;
  else if (rowAr && candidateAr && (candidateAr.includes(rowAr) || rowAr.includes(candidateAr))) score = 60;
  else if (rowEn && candidateEn && (candidateEn.includes(rowEn) || rowEn.includes(candidateEn))) score = 50;

  if (score === 0) return 0;
  if (candidate.riwaya === row.riwaya) score += 20;
  else if (row.riwaya !== 'unknown' && candidate.riwaya !== 'unknown') score -= 40;

  // A Mujawwad row must not silently point at the Murattal release: the name
  // and riwaya are the same, and the style is the only difference.
  const hint = styleHint(row);
  if (hint && candidate.style) score += candidate.style === hint ? 15 : -15;
  return score;
}

/**
 * Proposes links for rows that have none. It never writes: a wrong provider
 * link is worse than no link, so the operator sees the pairs and applies them.
 */
@Injectable()
export class LinkSuggestionsService {
  constructor(
    private readonly reciters: RecitersService,
    private readonly registry: ProviderRegistry,
  ) {}

  async suggestions(): Promise<LinkSuggestion[]> {
    const rows = this.reciters.list().filter((row) => !row.provider);
    if (rows.length === 0) return [];

    const catalogues = await Promise.all(
      this.registry.list().map(async (provider) => {
        try {
          return await this.registry.get(provider.id).search('');
        } catch {
          return [];
        }
      }),
    );
    const all = catalogues.flat();
    // A release already carried by another row is not a suggestion: clicking it
    // would hit the unique index and fail after the operator chose it.
    const used = new Set(
      this.reciters
        .list()
        .filter((row) => row.provider && row.releaseId)
        .map((row) => `${row.provider}:${row.releaseId}:${row.variant ?? ''}`),
    );

    return rows.map((row) => {
      const candidates = all
        .map((candidate) => ({ ...candidate, score: scoreOne(row, candidate) }))
        .filter(
          (candidate) =>
            candidate.score >= 50 &&
            !used.has(`${candidate.provider}:${candidate.releaseId}:${candidate.variant}`),
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return {
        rowId: row.id,
        name: row.name,
        nameAr: row.nameAr,
        riwaya: row.riwaya,
        candidates,
      };
    });
  }

  link(input: {
    rowId: number;
    provider: ProviderId;
    reciterId: string;
    releaseId: string;
    variant?: string;
  }) {
    const reciterId = input.reciterId?.trim();
    const releaseId = input.releaseId?.trim();
    if (!reciterId || !releaseId) throw new Error('choose a provider release first');

    const existing = this.reciters
      .list()
      .find(
        (row) =>
          row.id !== input.rowId &&
          row.provider === input.provider &&
          row.releaseId === releaseId &&
          (row.variant ?? '') === (input.variant ?? ''),
      );
    if (existing) {
      throw new Error(`this release is already linked to reciter ${existing.id}`);
    }

    const updated = this.reciters.linkProvider(input.rowId, {
      provider: input.provider,
      reciterId,
      releaseId,
      variant: input.variant ?? '',
    });
    if (!updated) throw new Error('reciter not found');
    return updated;
  }
}
