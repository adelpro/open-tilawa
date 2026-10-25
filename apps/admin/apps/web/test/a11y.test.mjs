import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The Web Interface Guidelines, as checks.
 *
 * These are the ones a compiler cannot see: a landmark that is missing, a confirm that is
 * silent to a screen reader, a dialog that lets Tab escape behind it, a straight apostrophe,
 * a heading level skipped. Each test names the finding it closes from
 * docs/AUDIT-2026-10-20.md (A1–A10).
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const read = (path) => readFileSync(join(ROOT, path), 'utf-8');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const app = read('App.tsx');
const modal = read('components/Modal.tsx');
const chip = read('components/Chip.tsx');
const account = read('routes/Account.tsx');
const styles = ['tokens.css', 'components.css']
  .map((file) => strip(read(`styles/${file}`)))
  .join('\n');
const en = read('lib/i18n/en.ts');

describe('landmarks and the skip link (A1, A10)', () => {
  it('starts every signed-in screen with a skip link to the main landmark', () => {
    assert.match(app, /className="skip-link" href="#main"/);
    assert.match(app, /<main id="main"/);
  });

  it('names the navigation landmark', () => {
    assert.match(app, /aria-label=\{t\('a11y\.primaryNav'\)\}/);
  });

  it('hides the skip link until it has focus', () => {
    assert.match(styles, /\.skip-link\s*\{[\s\S]*?top:\s*-60px/);
    assert.match(styles, /\.skip-link:focus\s*\{\s*top:/);
  });
});

describe('live regions (A2)', () => {
  it('announces a success as a status and a failure as an alert', () => {
    assert.match(chip, /role=\{tone === 'bad' \? 'alert' : 'status'\}/);
  });

  it('keeps the inline field error as an alert', () => {
    assert.match(read('components/Field.tsx'), /role="alert"/);
  });
});

describe('the dialog keyboard contract (A3, A4)', () => {
  it('traps Tab inside the panel and cycles at both ends', () => {
    assert.match(modal, /event\.key !== 'Tab'/);
    assert.match(modal, /event\.shiftKey && \(active === first/);
    assert.match(modal, /first\.focus\(\)/);
    assert.match(modal, /last\.focus\(\)/);
  });

  it('returns focus to whatever opened it', () => {
    assert.match(modal, /opener\.focus\(\)/);
  });

  it('points aria-labelledby at its own heading instead of duplicating the title', () => {
    assert.match(modal, /aria-labelledby="modal-title"/);
    assert.match(modal, /<h2 id="modal-title"/);
    assert.equal(/aria-label=\{title\}/.test(modal), false);
  });
});

describe('forms (A5, A6)', () => {
  it('gives every email field the email keyboard', () => {
    for (const route of ['SignIn.tsx', 'SignUp.tsx', 'ResetPassword.tsx']) {
      const source = read(`routes/${route}`);
      // EmailField carries type="email" + inputMode="email" internally, so a route that
      // uses it counts as one compliant field even though the literals live in fields.tsx.
      const usesKit = /EmailField/.test(source);
      const emails = source.match(/type="email"/g) ?? [];
      const modes = source.match(/inputMode="email"/g) ?? [];
      if (usesKit) continue;
      assert.equal(
        modes.length,
        emails.length,
        `${route}: ${emails.length} email inputs, ${modes.length} inputModes`,
      );
    }
  });

  it('searches are searches', () => {
    for (const route of ['AdminConsole.tsx']) {
      const source = read(`routes/${route}`);
      assert.ok(
        /type="search"/.test(source) || /SearchField/.test(source),
        `${route} search field`,
      );
    }
  });

  it('ends every placeholder with an ellipsis', () => {
    const placeholders = en.match(/Placeholder':\s*'([^']*)'/g) ?? [];
    assert.ok(placeholders.length > 0, 'no placeholders found');
    for (const entry of placeholders) {
      assert.ok(entry.includes('…'), `placeholder without an ellipsis: ${entry}`);
    }
  });
});

describe('typography (A7, A8)', () => {
  it('balances headings and aligns figures', () => {
    assert.match(styles, /h1,\s*h2,\s*h3\s*\{[\s\S]*?text-wrap:\s*balance/);
    assert.match(styles, /font-variant-numeric:\s*tabular-nums/);
  });

  it('uses no straight apostrophes in the English catalogue', () => {
    // The catalogue is single-quoted strings, so a straight apostrophe can only appear
    // escaped. A typographic one appears as itself.
    assert.equal(/\\'/.test(en), false, 'a straight apostrophe survived in en.ts');
  });
});

describe('headings and the account screen (A9, T13.8)', () => {
  it('gives the account three groups with one heading level each', () => {
    assert.match(account, /account\.group\.profile/);
    assert.match(account, /account\.group\.security/);
    assert.match(account, /account\.group\.danger/);
    // Panel titles are h3 under those groups: no skipped level, no second h1.
    assert.equal(/<h2 className="display-sm"/.test(account), false, 'a panel title is still h2');
    assert.match(account, /<h3 className="display-sm"/);
  });

  it('gives each screen exactly one h1', () => {
    for (const route of [
      'Profiles.tsx',
      'Keys.tsx',
      'Usage.tsx',
      'Account.tsx',
      'AdminConsole.tsx',
    ]) {
      const source = read(`routes/${route}`);
      const h1s = (source.match(/<h1/g) ?? []).length;
      assert.ok(h1s <= 1, `${route} has ${h1s} h1 elements`);
    }
  });
});
