import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const MESSAGES = new URL('../src/i18n/messages.ts', import.meta.url);

/**
 * One numeral system across the interface.
 *
 * The file used to mix them — `١٥ ثانية` on one line and `15 ثانية` on another — which
 * reads as an oversight rather than a style. Western digits win because they are what the
 * rest of the file already uses, and because an Arabic-Indic zero is not typed by anyone
 * who is going to search for it.
 *
 * The input normaliser in `src/utils/search.ts` is the deliberate exception: it converts
 * Arabic-Indic digits a listener *types* into ASCII, and its tests assert that.
 */
test('no Arabic-Indic digits in user-facing copy', () => {
  const source = readFileSync(MESSAGES, 'utf-8');
  const offenders = source
    .split('\n')
    .map((line, index) => [index + 1, line] as const)
    .filter(([, line]) => /[\u0660-\u0669]/.test(line))
    .map(([index]) => index);

  assert.deepEqual(offenders, [], 'use 8, 15, 1 — not ٨, ١٥, ١');
});
