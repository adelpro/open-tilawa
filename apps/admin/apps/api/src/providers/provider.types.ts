/** The providers the console can read from. Adding one is a new module. */
export const PROVIDER_IDS = ['itqan', 'mp3quran', 'quranfoundation'] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * One release as the form sees it: the person, the particular recording, and
 * everything the provider knows without fetching 114 tracks.
 */
export interface ProviderReleaseSummary {
  provider: ProviderId;
  /** The provider's id for the person (Itqan reciter, MP3Quran reciter, QF chapter reciter). */
  reciterId: string;
  /** The provider's id for this recording (Itqan recitation, MP3Quran moshaf). */
  releaseId: string;
  /** Itqan folder slug; '' when the provider has no variants. */
  variant: string;
  name: string;
  nameAr: string | null;
  /** Catalogue vocabulary: Hafs, Warsh, Qalon, Shubah an asim, al-Douri, unknown. */
  riwaya: string;
  style: string | null;
  surahCount: number;
  sizeBytes: number | null;
}

export interface ProviderTrack {
  surah: number;
  url: string;
  sizeBytes: number | null;
}

/** A summary plus the track list the seeder needs. */
export interface ProviderRelease extends ProviderReleaseSummary {
  tracks: ProviderTrack[];
}

export interface ReciterProvider {
  readonly id: ProviderId;
  readonly label: string;
  search(query: string): Promise<ProviderReleaseSummary[]>;
  release(reciterId: string, releaseId: string, variant?: string): Promise<ProviderRelease>;
}
