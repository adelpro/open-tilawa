import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { Parsed } from '../src/routes.ts';
import type { Reciter } from '../src/types/reciter.ts';
import { planDeepLink, resolveDeepLink } from '../src/utils/deep-link.ts';

const reciter = (over: Partial<Reciter> = {}): Reciter => ({
  id: 9,
  name: 'ماهر المعيقلي',
  magnet: 'magnet:?xt=urn:btih:5e0becf35d91ea4602f04db90d74621a172aa396&dn=x',
  riwaya: 'hafs',
  complet: true,
  surahs: null,
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

/**
 * Enough of the effect to prove what it records. The defect was not in
 * `resolveDeepLink` — a stale name was always a redirect — but in the caller
 * writing the canonical href before navigating, so the target looked applied.
 */
function runEffect(
  route: Parameters<typeof planDeepLink>[0],
  reciters: Reciter[],
  applied: { current: string },
) {
  const plan = planDeepLink(route, reciters, applied.current);
  if (plan.kind === 'apply') applied.current = plan.href;
  return { plan, selected: plan.kind === 'apply' ? plan.reciter : null };
}

test('a redirect consumes nothing: the canonical address still selects the reciter', () => {
  const applied = { current: '' };

  const first = runEffect(listen({ surahName: 'alkahf' }), [reciter()], applied);
  assert.equal(first.plan.kind, 'moved');
  assert.equal(applied.current, '');

  const second = runEffect(listen(), [reciter()], applied);
  assert.equal(second.plan.kind, 'apply');
  assert.equal(second.selected?.slug, 'maher-al-muaiqly');
  assert.equal(applied.current, '/listen/maher-al-muaiqly/18-al-kahf');
});

test('a link already applied this mount is skipped', () => {
  const plan = planDeepLink(listen(), [reciter()], '/listen/maher-al-muaiqly/18-al-kahf');
  assert.equal(plan.kind, 'skip');
});

test('a surah the release does not carry is missing, not a dead player', () => {
  const partial = reciter({ surahs: [1, 18, 19] });
  const absent = resolveDeepLink(listen({ surah: 2, surahName: 'al-baqarah' }), [partial]);
  assert.equal(absent.kind, 'missing');
  const carried = resolveDeepLink(listen(), [partial]);
  assert.equal(carried.kind, 'ok');
});

test('a null manifest keeps the old answer: nothing is refused', () => {
  const unknown = reciter({ surahs: null });
  assert.equal(resolveDeepLink(listen({ surah: 2, surahName: 'al-baqarah' }), [unknown]).kind, 'ok');
});

test('a release with no slug yet has no link, and is not a redirect loop', () => {
  const result = resolveDeepLink(listen(), [reciter({ slug: '' })]);
  assert.equal(result.kind, 'missing');
});

test('the slug is matched exactly, not by prefix', () => {
  assert.equal(resolveDeepLink(listen({ release: 'maher' }), [reciter()]).kind, 'missing');
});
