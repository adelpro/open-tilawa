import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Parsed } from '../src/routes.ts';
import type { Reciter } from '../src/types/reciter.ts';
import { resolveDeepLink } from '../src/utils/deep-link.ts';

const reciter = (over: Partial<Reciter> = {}): Reciter => ({
  id: 9,
  name: 'ماهر المعيقلي',
  magnet: 'magnet:?xt=urn:btih:5e0becf35d91ea4602f04db90d74621a172aa396&dn=x',
  riwaya: 'hafs',
  complet: true,
  slug: 'maher-al-muaiqly',
  ...over,
});

const listen = (over: Partial<Extract<Parsed, { name: 'listen' }>> = {}) =>
  ({ name: 'listen', release: 'maher-al-muaiqly', surah: 18, surahName: 'al-kahf', ...over }) as const;

test('a known slug and surah resolve to the release', () => {
  const result = resolveDeepLink(listen(), [reciter()]);
  assert.equal(result.kind, 'ok');
  if (result.kind !== 'ok') return;
  assert.equal(result.reciter.slug, 'maher-al-muaiqly');
  assert.equal(result.surah, 18);
});

test('a stale surah name is a redirect, not a page', () => {
  const result = resolveDeepLink(listen({ surahName: 'alkahf' }), [reciter()]);
  assert.equal(result.kind, 'moved');
  if (result.kind !== 'moved') return;
  assert.equal(result.to, '/listen/maher-al-muaiqly/18-al-kahf');
});

test('an unknown slug is missing', () => {
  assert.equal(resolveDeepLink(listen({ release: 'nobody' }), [reciter()]).kind, 'missing');
});

test('a release with no slug yet has no link, and is not a redirect loop', () => {
  const result = resolveDeepLink(listen(), [reciter({ slug: '' })]);
  assert.equal(result.kind, 'missing');
});

test('the slug is matched exactly, not by prefix', () => {
  assert.equal(resolveDeepLink(listen({ release: 'maher' }), [reciter()]).kind, 'missing');
});
