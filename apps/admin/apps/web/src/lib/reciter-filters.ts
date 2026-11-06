/**
 * The catalogue's filter arithmetic, with no React in it.
 *
 * The table shows one scope, one reading and one source at a time. Those are
 * facts about a row, so they belong here where a unit test can hold them — the
 * route only renders the controls and hands over the state.
 */

/** Which half of the catalogue is on screen. Defaults to published. */
export type ReciterScope = 'published' | 'drafts' | 'all';

export type ReciterFilterState = {
  scope: ReciterScope;
  /** Search over both names; matched with `fold` below, not verbatim. */
  query: string;
  /** '' means every reading; otherwise the stored value (`Hafs`, `Warsh`…). */
  riwaya: string;
  /** Empty means every source. Otherwise any of these ids or `NO_PROVIDER`. */
  providers: string[];
};

export const EMPTY_RECITER_FILTERS: ReciterFilterState = {
  scope: 'published',
  query: '',
  riwaya: '',
  providers: [],
};

/** The source value for a torrent entered by hand. Never a real provider id. */
export const NO_PROVIDER = '__none__';

export type ReciterFilterFields = {
  name: string;
  nameAr: string | null;
  riwaya: string;
  provider: string | null;
  published: boolean;
};

/**
 * What a search term and a stored name have in common.
 *
 * Case, Latin accents and Arabic spelling marks are typing furniture, not part
 * of a name: `أحمد` and `احمد` are the same person, and so are `تلاوة` and
 * `تلاوه`. Folding both sides means one search box works in either script and
 * on any keyboard layout, instead of failing on a hamza the operator did not
 * type. It never changes what is stored.
 */
function fold(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Whether one row survives every control, combined with AND. */
export function matchesReciter(row: ReciterFilterFields, filters: ReciterFilterState): boolean {
  const inScope =
    filters.scope === 'all' ? true : filters.scope === 'published' ? row.published : !row.published;
  if (!inScope) return false;

  if (filters.riwaya !== '' && row.riwaya !== filters.riwaya) return false;

  if (filters.providers.length > 0) {
    const source = row.provider ?? NO_PROVIDER;
    if (!filters.providers.includes(source)) return false;
  }

  const needle = fold(filters.query);
  if (needle === '') return true;
  return fold(row.name).includes(needle) || fold(row.nameAr ?? '').includes(needle);
}

/** The rows that survive the controls, as a new array. */
export function filterReciters<T extends ReciterFilterFields>(
  rows: readonly T[],
  filters: ReciterFilterState,
): T[] {
  return rows.filter((row) => matchesReciter(row, filters));
}

/**
 * Whether something other than the scope is narrowing the list.
 *
 * The scope tabs are always one of three, so they are not a filter to clear;
 * the search box, the reading and the sources are.
 */
export function hasActiveFilters(filters: ReciterFilterState): boolean {
  return filters.query.trim() !== '' || filters.riwaya !== '' || filters.providers.length > 0;
}

/** Add a source to the selection, or take it out again. */
export function toggleProvider(providers: readonly string[], id: string): string[] {
  return providers.includes(id)
    ? providers.filter((provider) => provider !== id)
    : [...providers, id];
}

export type ProviderChoice = { id: string; label: string };

/**
 * The providers worth offering, in the server's order.
 *
 * Only sources that actually hold a row: a filter that can return nothing is
 * noise. A stored id the provider list no longer names stays visible (labelled
 * with the id) so its rows are not unreachable — the alternative is a filter
 * that lies by omission.
 */
export function providerChoices<T extends { provider: string | null }>(
  rows: readonly T[],
  providers: readonly ProviderChoice[],
): ProviderChoice[] {
  const present = new Set<string>();
  for (const row of rows) {
    if (row.provider) present.add(row.provider);
  }

  const choices: ProviderChoice[] = [];
  const seen = new Set<string>();
  for (const provider of providers) {
    if (!present.has(provider.id) || seen.has(provider.id)) continue;
    seen.add(provider.id);
    choices.push({ id: provider.id, label: provider.label });
  }
  for (const id of present) {
    if (seen.has(id)) continue;
    seen.add(id);
    choices.push({ id, label: id });
  }
  return choices;
}
