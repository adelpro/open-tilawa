import assert from 'node:assert/strict';
import { test } from 'node:test';

import { sortByArabicName } from '../src/utils/reciter-order.ts';

const row = (nameAr: string | null, name = nameAr ?? '') => ({ nameAr, name });

/** What the label on screen says: the Arabic name, else the cleaned torrent name. */
const nameOf = (entry: { nameAr: string | null; name: string }) =>
  entry.nameAr?.trim() || entry.name;

test('the roster sorts the way Arabic reads it', () => {
  const sorted = sortByArabicName(
    [
      row('ياسين الجزائري'),
      row('عبد الباسط عبد الصمد'),
      row('ماهر المعيقلي'),
      row('محمد صديق المنشاوي'),
      row('محمود خليل الحصري'),
      row('مفتاح السلطني'),
    ],
    nameOf,
  );

  assert.deepEqual(
    sorted.map((entry) => entry.nameAr),
    [
      'عبد الباسط عبد الصمد',
      'ماهر المعيقلي',
      'محمد صديق المنشاوي',
      'محمود خليل الحصري',
      'مفتاح السلطني',
      'ياسين الجزائري',
    ],
  );
});

test('hamza forms stay with their alif instead of splitting the list', () => {
  const sorted = sortByArabicName(
    [row('أحمد'), row('بكر'), row('إبراهيم'), row('آمنة')],
    nameOf,
  );

  assert.deepEqual(sorted.map((entry) => entry.nameAr), ['آمنة', 'إبراهيم', 'أحمد', 'بكر']);
});

test('a row without an Arabic name sorts by the name it shows', () => {
  const sorted = sortByArabicName([row('بكر'), row(null, 'أحمد')], nameOf);

  assert.deepEqual(sorted.map((entry) => entry.name), ['أحمد', 'بكر']);
});
