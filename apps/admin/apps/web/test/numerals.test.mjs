import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const I18N = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'i18n');

/**
 * The console is Arabic-first, and one numeral system keeps it look like one product.
 * It has no Arabic-Indic digits today; this test is what keeps that true.
 */
test('no Arabic-Indic digits in console copy', () => {
  const offenders = [];

  for (const file of readdirSync(I18N).filter((name) => name.endsWith('.ts'))) {
    const lines = readFileSync(join(I18N, file), 'utf-8').split('\n');
    lines.forEach((line, index) => {
      if (/[\u0660-\u0669]/.test(line)) offenders.push(`${file}:${index + 1}`);
    });
  }

  assert.deepEqual(offenders, [], 'use 8, 15, 1 — not ٨, ١٥, ١');
});
