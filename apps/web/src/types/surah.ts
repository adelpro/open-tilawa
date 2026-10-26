export type Surah = {
  id: number;
  name: string;
  /** Verses in the surah (Hafs). */
  ayahCount: number;
  /** Juz the surah starts in. */
  juz: number;
  /** Mushaf page the surah starts on. */
  page: number;
};
