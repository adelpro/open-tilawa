import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RIWAYAT,
  isUnclassified,
  riwayaLabel,
  riwayaOptions,
  riwayaValue,
} from '../src/lib/riwaya.ts';

/**
 * The riwaya list is the dashboard's half of a contract the public app already
 * implements (`apps/web/src/utils/riwaya.ts`): stored in Latin, shown in the
 * reading language. Three rules matter more than the words themselves — an
 * unclassified row stays unclassified, a legacy spelling that names a listed
 * reading is normalised, and a value that names no listed reading is never
 * guessed at or relabelled.
 */
describe('riwaya vocabulary', () => {
  it('lists an unclassified option so a row can stay honest', () => {
    const values = RIWAYAT.map((riwaya) => riwaya.value);
    assert.ok(values.includes('unknown'));
    assert.ok(isUnclassified('unknown'));
    assert.ok(isUnclassified(''));
    assert.ok(isUnclassified(null));
  });

  it('does not treat a real reading as unclassified', () => {
    assert.equal(isUnclassified('Hafs'), false);
    assert.equal(isUnclassified('Warsh'), false);
  });

  it('labels in the reading language and stores Latin', () => {
    assert.equal(riwayaLabel('Hafs', 'ar'), 'حفص');
    assert.equal(riwayaLabel('Hafs', 'en'), 'Hafs');
    assert.equal(riwayaLabel('unknown', 'ar'), 'غير محدّد');
    assert.equal(riwayaLabel('unknown', 'en'), 'Unspecified');
  });

  it('matches a stored value regardless of case', () => {
    assert.equal(riwayaLabel('hafs', 'ar'), 'حفص');
    assert.equal(riwayaLabel('WARSH', 'ar'), 'ورش');
  });

  it('shows an unknown legacy value exactly as it was stored', () => {
    assert.equal(riwayaLabel('حفص', 'en'), 'حفص');
    assert.equal(riwayaLabel('Jazari', 'ar'), 'Jazari');
  });

  it('opens the form on the canonical value a legacy spelling names', () => {
    // Typed into the old free-text field, before this list existed.
    assert.equal(riwayaValue('حفص'), 'Hafs');
    assert.equal(riwayaValue('Qalun'), 'Qalon');
    assert.equal(riwayaValue('qalon'), 'Qalon');
    assert.equal(riwayaValue('Hafs'), 'Hafs');
    assert.equal(riwayaValue(''), 'unknown');
  });

  it('does not guess at a reading the list does not hold', () => {
    assert.equal(riwayaValue('Jazari'), 'Jazari');
    assert.equal(riwayaValue('حفص عن عاصم'), 'حفص عن عاصم');
  });

  it('keeps an uncharted value selectable, marked as recorded', () => {
    const options = riwayaOptions('Jazari');
    assert.equal(options.length, RIWAYAT.length + 1);
    assert.equal(options.at(-1).value, 'Jazari');
    assert.match(options.at(-1).ar, /كما ورد/);
    assert.match(options.at(-1).en, /as recorded/);
  });

  it('does not duplicate a value the list already holds', () => {
    assert.equal(riwayaOptions('Hafs').length, RIWAYAT.length);
    assert.equal(riwayaOptions('حفص').length, RIWAYAT.length);
    assert.equal(riwayaOptions(null).length, RIWAYAT.length);
  });
});
