/** One release as the provider search returns it (mirrors the API type). */
export interface ProviderSummary {
  provider: string;
  reciterId: string;
  releaseId: string;
  variant: string;
  name: string;
  nameAr: string | null;
  riwaya: string;
  style: string | null;
  surahCount: number;
  sizeBytes: number | null;
}

export interface ProviderDraftFields {
  name: string;
  nameAr: string;
  riwaya: string;
  fileCount: string;
  sizeGb: string;
  provider: string;
  reciterId: string;
  releaseId: string;
  variant: string;
}

/**
 * What selecting a provider release puts in the form.
 *
 * Deliberately excludes `infohash` and `magnet`: those are the seeder's job, and
 * a provider cannot know them. The torrent fields stay hidden in provider mode.
 */
export function applyProviderRelease(release: ProviderSummary): ProviderDraftFields {
  return {
    name: release.name,
    nameAr: release.nameAr ?? '',
    riwaya: release.riwaya,
    fileCount: String(release.surahCount),
    sizeGb: release.sizeBytes === null ? '' : (release.sizeBytes / 1024 ** 3).toFixed(2),
    provider: release.provider,
    reciterId: release.reciterId,
    releaseId: release.releaseId,
    variant: release.variant,
  };
}

/** `Badr Al-Turki (Hafs)` → `Badr_Al-Turki_Hafs`; the seeder only accepts [A-Za-z0-9_-]. */
export function folderFromRelease(release: ProviderSummary): string {
  const suffix = release.riwaya === 'unknown' ? '' : `_${release.riwaya}`;
  const base = release.name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '');
  return `${base || 'Release'}${suffix.replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 80);
}

/** The body of `POST /reciters/import`; no torrent fields are sent. */
export function importPayload(
  release: ProviderSummary,
  folderName: string,
  seederId: number,
  publish: boolean,
) {
  return {
    provider: release.provider,
    reciterId: release.reciterId,
    releaseId: release.releaseId,
    variant: release.variant,
    seederId,
    folderName,
    publish,
  };
}
