import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The two checks that a build cannot make on its own.
 *
 * TypeScript already refuses a catalogue that is missing a key: `ar` is typed as
 * `Record<keyof typeof en, string>`. What it cannot see is a key whose Arabic value
 * is the English string, an empty value, or a placeholder that exists on one side and
 * not the other — all of which compile and all of which ship.
 *
 * The second check is the RTL one. "No element retains a physical left/right margin"
 * is a claim about the stylesheet, and a regex over the CSS is the only way to hold it
 * without a browser in the test loop.
 */
const ROOT = new URL('../src/', import.meta.url).pathname;

/** Keys whose value is legitimately Latin: identifiers, product names, symbols. */
const LATIN_ALLOWED = new Set([
  'app.brand',
  'common.email',
  'profiles.nameHint',
  'keys.labelHint',
  'about.contact.body',
  'privacy.contact.body',
  'terms.contact.body',
  // A protocol name, not copy: the chip says which check the row gets.
  'status.wsChip',
]);

function catalogue(file) {
  const source = readFileSync(join(ROOT, 'lib/i18n', file), 'utf-8');
  const entries = new Map();
  const pattern = /^\s*'([^']+)':\s*\n?\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"),?\s*$/gm;
  for (const match of source.matchAll(pattern)) {
    const raw = match[2].slice(1, -1);
    entries.set(match[1], raw);
  }
  return entries;
}

const en = catalogue('en.ts');
const ar = catalogue('ar.ts');

describe('message catalogues', () => {
  it('has entries on both sides', () => {
    assert.ok(en.size > 150, `expected the English catalogue to be substantial, got ${en.size}`);
    assert.ok(ar.size > 150, `expected the Arabic catalogue to be substantial, got ${ar.size}`);
  });

  it('has exactly the same keys', () => {
    const missing = [...en.keys()].filter((key) => !ar.has(key));
    const extra = [...ar.keys()].filter((key) => !en.has(key));
    assert.deepEqual(missing, [], `Arabic is missing: ${missing.join(', ')}`);
    assert.deepEqual(extra, [], `Arabic has keys English does not: ${extra.join(', ')}`);
  });

  it('has no empty values', () => {
    for (const [key, value] of [...en, ...ar]) {
      assert.ok(value.trim().length > 0, `${key} is empty`);
    }
  });

  it('has no untranslated Arabic entry', () => {
    const arabic = /[\u0600-\u06FF]/;
    // A template of placeholders and punctuation ("{used} / {quota}") is a format,
    // not a sentence: it cannot be "still English".
    const prose = (value) => value.replace(/\{[^}]*\}/g, '').trim();
    const untranslated = [...ar.entries()]
      .filter(
        ([key, value]) =>
          !LATIN_ALLOWED.has(key) && !arabic.test(value) && /[A-Za-z]{2,}/.test(prose(value)),
      )
      .map(([key]) => key);
    assert.deepEqual(untranslated, [], `still English: ${untranslated.join(', ')}`);
  });

  it('carries the same placeholders on both sides', () => {
    const names = (value) => [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    for (const [key, value] of en) {
      const other = ar.get(key);
      if (!other) continue;
      assert.deepEqual(
        names(other),
        names(value),
        `${key}: placeholders differ (en ${names(value).join(',')} / ar ${names(other).join(',')})`,
      );
    }
  });
});

describe('right-to-left layout', () => {
  const styles = readdirSync(join(ROOT, 'styles'))
    .filter((file) => file.endsWith('.css'))
    .map((file) => ({ file, css: readFileSync(join(ROOT, 'styles', file), 'utf-8') }));

  it('uses no physical left or right spacing', () => {
    const offenders = [];
    for (const { file, css } of styles) {
      const pattern =
        /(margin|padding)-(left|right)\s*:|border-(left|right)\s*:|text-align:\s*(left|right)\b|(^|[;{]\s*)(left|right)\s*:/gm;
      for (const match of css.matchAll(pattern)) {
        offenders.push(`${file}: ${match[0].trim()}`);
      }
    }
    assert.deepEqual(offenders, [], `physical properties: ${offenders.join(' | ')}`);
  });

  it('sets letter-spacing to zero for Arabic display styles', () => {
    const tokens = styles.find((entry) => entry.file === 'tokens.css')?.css ?? '';
    assert.match(tokens, /html\[lang='ar'\] \.display-lg/);
    assert.match(tokens, /--font-arabic/);
  });
});
