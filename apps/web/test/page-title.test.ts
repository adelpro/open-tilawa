import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MESSAGES } from '../src/i18n/messages.ts';
import { documentTitle, pageTitle } from '../src/utils/page-title.ts';

const ar = MESSAGES.ar;

test('a page that is not the player names itself in the tab', () => {
  assert.equal(pageTitle({ name: 'about' }, ar), `${ar.routes.about} — Tilawah`);
  assert.equal(pageTitle({ name: 'privacy' }, ar), `${ar.routes.privacy} — Tilawah`);
  assert.equal(pageTitle({ name: 'settings' }, ar), `${ar.routes.settings} — Tilawah`);
  assert.equal(pageTitle({ name: 'notFound' }, ar), `${ar.notFound.title} — Tilawah`);
});

test('the player answers for the routes it renders', () => {
  // Home, a deep link, and the hub rows whose screen is still the player. Their tab is
  // the recitation, which is the whole reason the title effect lives in the audio engine.
  for (const route of [
    { name: 'home' },
    { name: 'listen', release: 'minshawi', surah: 18, surahName: 'al-kahf' },
    { name: 'surahs' },
    { name: 'reciters' },
  ] as const) {
    assert.equal(pageTitle(route, ar), null, route.name);
  }
});

test('the tab carries what is playing, and nothing when nothing is', () => {
  const name = 'الكهف';
  assert.equal(documentTitle({ name: 'home' }, ar, name), `${name} — Tilawah`);
  assert.equal(documentTitle({ name: 'home' }, ar, ''), 'Tilawah');
});

test('a page keeps its own title even while a recitation is loaded', () => {
  // Hydration must not rename the document the prerendered HTML handed the crawler.
  assert.equal(documentTitle({ name: 'about' }, ar, 'الكهف'), `${ar.routes.about} — Tilawah`);
});

test('the prerendered titles are the strings the app sets', () => {
  // The build and the client share `pageTitle`, so a rename cannot leave the HTML and the
  // hydrated tab disagreeing about what the page is called.
  const en = MESSAGES.en;
  assert.equal(pageTitle({ name: 'about' }, en), `${en.routes.about} — Tilawah`);
  assert.equal(pageTitle({ name: 'privacy' }, ar), `${ar.routes.privacy} — Tilawah`);
});
