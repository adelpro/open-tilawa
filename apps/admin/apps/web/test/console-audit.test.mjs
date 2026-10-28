import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The console audit's P0 items, as checks.
 *
 * `docs/superpowers/reviews/2026-10-28-admin-console-audit.md` measured five
 * breakages. Four of them are one missing rule each, and each one is the kind a
 * build cannot see: a document that scrolls behind its own dialog, a touch rule
 * defeated by a later modifier, an English label in an Arabic screen, a select
 * wearing a class that does not exist. They are pinned here so they cannot come
 * back quietly.
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const read = (path) => readFileSync(join(ROOT, path), 'utf-8');
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');

const modal = read('components/Modal.tsx');
const consoleScreen = read('routes/AdminConsole.tsx');
const account = read('routes/Account.tsx');
const styles = strip(
  ['tokens.css', 'components.css'].map((file) => read(`styles/${file}`)).join('\n'),
);

describe('console audit — the dialog owns the viewport', () => {
  it('locks the document while it is open', () => {
    assert.match(modal, /body\.style\.overflow = 'hidden';/);
  });

  it('pays back the scrollbar width so the page does not shift sideways', () => {
    assert.match(modal, /innerWidth - documentElement\.clientWidth/);
    assert.match(modal, /paddingInlineEnd/);
  });

  it('restores both on the way out', () => {
    assert.match(modal, /body\.style\.overflow = previousOverflow;/);
    assert.match(modal, /body\.style\.paddingInlineEnd = previousPaddingInlineEnd;/);
  });
});

describe('console audit — touch targets', () => {
  it('gives the small row action a 44px floor on a coarse pointer', () => {
    const coarse = styles.match(/@media \(pointer: coarse\) \{[\s\S]*?\n\}/)?.[0] ?? '';
    // Two classes: same specificity as `.btn`, more than `.btn--sm`, so order cannot defeat it.
    assert.match(coarse, /\.btn\.btn--sm \{[^}]*min-height: 44px/);
  });
});

describe('console audit — the console speaks the reader’s language', () => {
  it('has no English literals in an Arabic-first screen', () => {
    for (const literal of ['>Role<', '>Status<', '>All<', '>active<', '>disabled<']) {
      assert.equal(consoleScreen.includes(literal), false, `found literal ${literal}`);
    }
  });

  it('names roles and statuses through the catalogue, not the raw enum', () => {
    assert.match(consoleScreen, /admin\.roleUser/);
    assert.match(consoleScreen, /admin\.statusActive/);
    // A chip whose only child is the enum is the bug; the enum as a title is the intent.
    assert.equal(/<Chip[^>]*>\s*\{entry\.(role|status)\}/.test(consoleScreen), false);
  });

  it('labels the two filter controls', () => {
    assert.match(consoleScreen, /t\('admin\.role'\)/);
    assert.match(consoleScreen, /t\('common\.status'\)/);
  });
});

describe('console audit — a select is a select', () => {
  it('never dresses a select as a text input', () => {
    assert.equal(consoleScreen.includes('className="input"'), false);
    assert.equal(account.includes('className="input"'), false);
  });

  it('uses the design system’s select on both screens', () => {
    assert.match(consoleScreen, /className="field__select"/);
    assert.match(account, /className="field__select/);
  });
});
