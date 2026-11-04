import assert from 'node:assert/strict';
import { test } from 'node:test';

import { reciterName } from '../src/utils/reciter-name.ts';

const reciter = { name: 'ياسين الجزائري', nameEn: 'Yassine El Jazairi' };

test('the Arabic screen keeps the Arabic name', () => {
  assert.equal(reciterName(reciter, 'ar'), 'ياسين الجزائري');
});

test('the English screen shows the latin name', () => {
  assert.equal(reciterName(reciter, 'en'), 'Yassine El Jazairi');
});

test('a cached row from before the latin name falls back to Arabic', () => {
  assert.equal(reciterName({ name: 'ياسين الجزائري' }, 'en'), 'ياسين الجزائري');
});
