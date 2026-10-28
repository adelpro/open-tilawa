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

describe('console audit — the dialog does not steal focus back', () => {
  it('focuses the panel once, outside the listener effect', () => {
    assert.match(modal, /panel\.current\?\.focus\(\);\n  \}, \[\]\);/);
  });

  it('reads the current close handler through a ref', () => {
    assert.match(modal, /closeRef\.current = close;/);
    assert.match(modal, /closeRef\.current\(\);/);
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

/* ---------- batch C: action columns and confirms ---------- */

const turns = read('routes/Turns.tsx');
const status = read('routes/Status.tsx');
const torrents = read('routes/Torrents.tsx');
const reciters = read('routes/Reciters.tsx');

describe('console audit — one action column', () => {
  it('no row-action cell still uses the wrapping cluster', () => {
    // `cluster--end` is right for a dialog footer and wrong for a table cell: in RTL
    // it pins the buttons to the edge opposite the column header.
    for (const [name, source] of [
      ['Turns', turns],
      ['AdminConsole', consoleScreen],
      ['Torrents', torrents],
    ]) {
      assert.equal(
        source.includes('<span className="cluster cluster--end">'),
        false,
        `${name} still wraps its row actions`,
      );
      assert.match(source, /row__actions/);
    }
  });
});

describe('console audit — every destructive action asks first', () => {
  it('routes every confirm through one component', () => {
    for (const [name, source] of [
      ['Reciters', reciters],
      ['Torrents', torrents],
      ['Turns', turns],
      ['Status', status],
    ]) {
      assert.match(source, /ConfirmModal/, `${name} has no ConfirmModal`);
    }
  });

  it('has no hand-rolled destructive dialog left', () => {
    const handRolled =
      /<Modal title=\{t\('(reciters\.deleteTitle|torrents\.untrackedTitle|seeders\.updateTitle|seeders\.unlink)'\)/;
    assert.equal(handRolled.test(reciters), false);
    assert.equal(handRolled.test(torrents), false);
  });
});

/* ---------- batch D: forms are dialogs ---------- */

const formModal = read('components/FormModal.tsx');

describe('console audit — one form host', () => {
  it('every create and edit goes through FormModal', () => {
    for (const [name, source] of [
      ['Seeders', read('routes/Seeders.tsx')],
      ['Turns', turns],
      ['Reciters', reciters],
      ['Status', status],
      ['Torrents', torrents],
    ]) {
      assert.match(source, /FormModal/, `${name} has no FormModal`);
      assert.equal(
        /\{showAdd \? \(\s*<Panel/.test(source),
        false,
        `${name} still opens its add form in a panel`,
      );
      assert.equal(
        /\{editing \? \(\s*<Panel/.test(source),
        false,
        `${name} still opens its edit form in a panel`,
      );
    }
  });

  it('focuses the first field, not the dialog', () => {
    assert.match(formModal, /querySelector<HTMLElement>\('input, textarea, select'\)/);
    assert.match(formModal, /requestAnimationFrame\(\(\) => field\.focus\(\)\)/);
  });

  it('submits on Enter and never submits a disabled form', () => {
    assert.match(formModal, /onSubmit=\{\(event\) => \{/);
    assert.match(formModal, /event\.preventDefault\(\);/);
    assert.match(formModal, /if \(!busy && !disabled\) onSubmit\(\);/);
  });
});

describe('console audit — a row is not a link full of buttons', () => {
  it('drops role="link" from rows that carry buttons', () => {
    for (const [name, source] of [
      ['Seeders', read('routes/Seeders.tsx')],
      ['Turns', turns],
    ]) {
      assert.equal(source.includes('role="link"'), false, `${name} still has a link row`);
    }
  });

  it('gives the name a real anchor instead', () => {
    assert.match(read('routes/Seeders.tsx'), /<a className="row__label" \{\.\.\.linkProps/);
    assert.match(turns, /<a className="row__label" \{\.\.\.linkProps/);
  });
});

/* ---------- tokens ---------- */
/** Relative luminance of a #rrggbb string, enough to compare two surfaces. */
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

const tokens = strip(read('styles/tokens.css'));

describe('console audit — elevation and type, in tokens', () => {
  it('never paints a card darker than the page under it', () => {
    // The darkest page surface in either theme; a card may be lighter, never darker.
    const page = '#1c1c1e';
    const canvases = [...tokens.matchAll(/--canvas:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
    assert.ok(canvases.length >= 2, 'expected a light and a dark --canvas');
    for (const value of canvases) {
      assert.ok(
        luminance(value) > luminance(page),
        `--canvas ${value} is not lighter than the page ${page}`,
      );
    }
  });

  it('sets Arabic display type at least as large as Latin, with heading leading', () => {
    const latin = tokens.match(/--display-lg:\s*\d+\s+([\d.]+)rem\/([\d.]+)/);
    const arabic = tokens.match(/--display-lg:\s*\d+\s+([\d.]+)rem\/([\d.]+)\s+var\(--font-arabic\)/);
    assert.ok(latin && arabic, 'both display-lg tiers must exist');
    assert.ok(
      Number(arabic[1]) >= Number(latin[1]),
      `Arabic display ${arabic[1]}rem is smaller than Latin ${latin[1]}rem`,
    );
    assert.ok(
      Number(arabic[2]) < 1.45,
      `Arabic display leading ${arabic[2]} is paragraph leading, not heading leading`,
    );
  });
});
