/**
 * The riwaya vocabulary: stored in Latin, shown in the reading language.
 *
 * The public app owns the display map (`apps/web/src/utils/riwaya.ts`); this list
 * is the same set, so anything the dashboard writes is something the reader can
 * name. Hafs, Warsh and Qalon are the three the pipeline actually carries — the
 * other two are here because the reader already knows how to render them.
 *
 * Stored values are not localised: `Hafs` is the value in the database, in the
 * torrent import script's whitelist and in the public catalogue, whatever the
 * dashboard happens to be showing.
 */
export interface Riwaya {
  /** Stored value, exactly as the catalogue and the import scripts expect it. */
  value: string;
  ar: string;
  en: string;
}

export const RIWAYAT: readonly Riwaya[] = [
  { value: 'Hafs', ar: 'حفص', en: 'Hafs' },
  { value: 'Warsh', ar: 'ورش', en: 'Warsh' },
  { value: 'Qalon', ar: 'قالون', en: 'Qalun' },
  { value: 'Shubah an asim', ar: 'شعبة عن عاصم', en: 'Shu‘bah ‘an ‘Asim' },
  { value: 'al-Duri', ar: 'الدوري', en: 'al-Duri' },
  { value: 'unknown', ar: 'غير محدّد', en: 'Unspecified' },
];

const KEY = (value: string): string => value.trim().toLowerCase();

const BY_VALUE = new Map(RIWAYAT.map((riwaya) => [KEY(riwaya.value), riwaya]));

/** Spellings the catalogue already contains that mean a listed value. */
const ALIASES = new Map([['qalun', 'qalon']]);

/**
 * The value a form should open with.
 *
 * A row typed before this list existed may hold an Arabic label (`حفص`) or the
 * `Qalun` spelling. Those name a listed reading, so the form opens on that
 * reading and saving normalises the stored value — same fact, pipeline spelling.
 * Anything that names no listed reading is returned verbatim: an uncharted
 * riwaya is not guessed at.
 */
export function riwayaValue(current: string | null | undefined): string {
  const raw = (current ?? '').trim();
  if (!raw) return 'unknown';
  const byValue = BY_VALUE.get(ALIASES.get(KEY(raw)) ?? KEY(raw));
  if (byValue) return byValue.value;
  const byLabel = RIWAYAT.find(
    (riwaya) => KEY(riwaya.ar) === KEY(raw) || KEY(riwaya.en) === KEY(raw),
  );
  return byLabel?.value ?? raw;
}

/**
 * A value that is not in the list is shown exactly as it came: a legacy row is
 * not relabelled into something the operator never typed.
 */
export function riwayaLabel(value: string | null | undefined, locale: 'ar' | 'en'): string {
  const raw = (value ?? '').trim();
  if (!raw) return BY_VALUE.get('unknown')![locale];
  const key = KEY(raw);
  return BY_VALUE.get(ALIASES.get(key) ?? key)?.[locale] ?? raw;
}

/**
 * The options for the row being edited. A value that matches no listed reading
 * keeps its own option, marked so nobody mistakes it for a canonical one.
 */
export function riwayaOptions(current: string | null | undefined): Riwaya[] {
  const raw = (current ?? '').trim();
  if (!raw || BY_VALUE.has(KEY(riwayaValue(raw)))) return [...RIWAYAT];
  return [
    ...RIWAYAT,
    { value: raw, ar: `${raw} (كما ورد)`, en: `${raw} (as recorded)` },
  ];
}

/** True when nobody has said which reading this release is — the honest default. */
export function isUnclassified(value: string | null | undefined): boolean {
  const raw = (value ?? '').trim();
  return raw === '' || KEY(raw) === 'unknown';
}
