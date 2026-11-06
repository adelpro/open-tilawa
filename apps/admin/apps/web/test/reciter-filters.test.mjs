import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  EMPTY_RECITER_FILTERS,
  NO_PROVIDER,
  filterReciters,
  hasActiveFilters,
  matchesReciter,
  providerChoices,
  toggleProvider,
} from '../src/lib/reciter-filters.ts';

/**
 * The catalogue's filter arithmetic, kept out of the route so the answer can be
 * checked without a browser: which rows survive a scope, a name search, a riwaya
 * and a provider, and what the provider control should offer.
 */

const rows = [
  {
    id: 1,
    name: 'Maher_Al-Muaiqly',
    nameAr: 'ماهر المعيقلي',
    riwaya: 'Hafs',
    provider: 'itqan',
    published: true,
  },
  {
    id: 2,
    name: 'Yasser_Al-Dosari',
    nameAr: 'ياسر الدوسري',
    riwaya: 'Warsh',
    provider: 'mp3quran',
    published: false,
  },
  {
    id: 3,
    name: 'Abdul_Basit',
    nameAr: null,
    riwaya: 'Hafs',
    provider: null,
    published: true,
  },
];

const ids = (list) => list.map((row) => row.id);

const filters = (overrides = {}) => ({ ...EMPTY_RECITER_FILTERS, ...overrides });

describe('reciter filters', () => {
  it('opens on the published half, like the table did before the filters', () => {
    assert.deepEqual(ids(filterReciters(rows, filters())), [1, 3]);
    assert.deepEqual(ids(filterReciters(rows, filters({ scope: 'drafts' }))), [2]);
    assert.deepEqual(ids(filterReciters(rows, filters({ scope: 'all' }))), [1, 2, 3]);
  });

  it('matches the riwaya exactly', () => {
    assert.deepEqual(ids(filterReciters(rows, filters({ scope: 'all', riwaya: 'Hafs' }))), [1, 3]);
    assert.deepEqual(ids(filterReciters(rows, filters({ scope: 'all', riwaya: 'Warsh' }))), [2]);
  });

  it('matches any selected provider, and the hand-entered rows by id', () => {
    assert.deepEqual(
      ids(filterReciters(rows, filters({ scope: 'all', providers: ['itqan'] }))),
      [1],
    );
    assert.deepEqual(
      ids(filterReciters(rows, filters({ scope: 'all', providers: ['itqan', 'mp3quran'] }))),
      [1, 2],
    );
    assert.deepEqual(
      ids(filterReciters(rows, filters({ scope: 'all', providers: [NO_PROVIDER] }))),
      [3],
    );
    assert.deepEqual(
      ids(filterReciters(rows, filters({ scope: 'all', providers: ['itqan', NO_PROVIDER] }))),
      [1, 3],
    );
  });

  it('finds a name in either script, ignoring case and Arabic spelling marks', () => {
    assert.deepEqual(ids(filterReciters(rows, filters({ query: 'maher' }))), [1]);
    assert.deepEqual(ids(filterReciters(rows, filters({ query: 'MAHER' }))), [1]);
    assert.deepEqual(ids(filterReciters(rows, filters({ query: 'ماهر' }))), [1]);
    // أ/ا and ة/ه are the same word typed on a different keyboard.
    assert.deepEqual(
      ids(filterReciters([{ ...rows[0], nameAr: 'أحمد بن علي' }], filters({ query: 'احمد' }))),
      [1],
    );
    assert.deepEqual(
      ids(filterReciters([{ ...rows[0], nameAr: 'تلاوة' }], filters({ query: 'تلاوه' }))),
      [1],
    );
  });

  it('ignores surrounding whitespace and an empty query', () => {
    assert.deepEqual(ids(filterReciters(rows, filters({ query: '   ' }))), [1, 3]);
    assert.deepEqual(ids(filterReciters(rows, filters({ query: '  ماهر  ' }))), [1]);
  });

  it('combines every control with AND and returns a new array', () => {
    const input = [...rows];
    assert.deepEqual(ids(filterReciters(input, filters({ riwaya: 'Hafs', query: 'maher' }))), [1]);
    assert.deepEqual(
      ids(filterReciters(rows, filters({ riwaya: 'Hafs', providers: ['mp3quran'] }))),
      [],
    );
    assert.deepEqual(ids(input), [1, 2, 3]);
    assert.notEqual(filterReciters(rows, filters()), rows);
  });

  it('reports whether anything but the scope is narrowing the list', () => {
    assert.equal(hasActiveFilters(filters()), false);
    assert.equal(hasActiveFilters(filters({ scope: 'all' })), false);
    assert.equal(hasActiveFilters(filters({ query: ' ' })), false);
    assert.equal(hasActiveFilters(filters({ query: 'maher' })), true);
    assert.equal(hasActiveFilters(filters({ riwaya: 'Hafs' })), true);
    assert.equal(hasActiveFilters(filters({ providers: [NO_PROVIDER] })), true);
    assert.equal(hasActiveFilters(filters({ providers: ['itqan', 'mp3quran'] })), true);
  });

  it('adds a provider to the selection and takes it out again, without duplicates', () => {
    assert.deepEqual(toggleProvider([], 'itqan'), ['itqan']);
    assert.deepEqual(toggleProvider(['itqan'], 'mp3quran'), ['itqan', 'mp3quran']);
    assert.deepEqual(toggleProvider(['itqan', 'mp3quran'], 'itqan'), ['mp3quran']);
    assert.deepEqual(toggleProvider(['itqan'], 'itqan'), []);
    // A new array every time: React must see a change even when the order holds.
    const current = ['itqan'];
    assert.notEqual(toggleProvider(current, 'mp3quran'), current);
  });
});

describe('provider choices', () => {
  it('offers the providers present in the catalogue, in the server order', () => {
    assert.deepEqual(providerChoices(rows, [
      { id: 'mp3quran', label: 'MP3Quran' },
      { id: 'itqan', label: 'Itqan' },
      { id: 'quranfoundation', label: 'Quran Foundation' },
    ]), [
      { id: 'mp3quran', label: 'MP3Quran' },
      { id: 'itqan', label: 'Itqan' },
    ]);
  });

  it('keeps an unknown stored provider visible rather than hiding its rows', () => {
    assert.deepEqual(
      providerChoices([{ provider: 'legacy' }, { provider: null }], []),
      [{ id: 'legacy', label: 'legacy' }],
    );
  });

  it('offers one option per provider, never a duplicate', () => {
    assert.deepEqual(providerChoices([{ provider: 'itqan' }, { provider: 'itqan' }], [
      { id: 'itqan', label: 'Itqan' },
    ]), [{ id: 'itqan', label: 'Itqan' }]);
  });
});
