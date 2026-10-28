import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The motion and craft rules, checked as text.
 *
 * A stylesheet has no types, so the invariants that a build cannot catch are asserted
 * here: that no rule animates everything, that press is fast and shallow, that reduced
 * motion still shows feedback, that small text is not set solid, and that the phone gets a
 * bar rather than a stacked sidebar. The numbers came out of docs/AUDIT-UI-2026-10-20.md;
 * this file is what stops them drifting back.
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const styleFiles = readdirSync(join(ROOT, 'styles')).filter((file) => file.endsWith('.css'));
const css = Object.fromEntries(
  styleFiles.map((file) => [file, readFileSync(join(ROOT, 'styles', file), 'utf-8')]),
);
// Comments explain the old values on purpose ("0.95 over 160ms was the first attempt"),
// so every assertion runs against the rules with the commentary stripped.
const strip = (source) => source.replace(/\/\*[\s\S]*?\*\//g, '');
const all = strip(Object.values(css).join('\n'));
const components = readFileSync(join(ROOT, 'components/Button.tsx'), 'utf-8');
const modal = readFileSync(join(ROOT, 'components/Modal.tsx'), 'utf-8');
const app = readFileSync(join(ROOT, 'App.tsx'), 'utf-8');

describe('press and hover', () => {
  it('never animates every property', () => {
    assert.equal(/transition:\s*all\b/.test(all), false, 'transition: all found in a stylesheet');
  });

  it('presses in 100ms at 0.97, not 160ms at 0.95', () => {
    assert.match(all, /--motion-press:\s*100ms/);
    assert.match(all, /transform:\s*scale\(0\.97\)/);
    assert.equal(/scale\(0\.95\)/.test(all), false, 'the old 0.95 press is still here');
  });

  it('has one vocabulary: press, ui, enter', () => {
    for (const token of ['--motion-press', '--motion-ui', '--motion-enter']) {
      assert.match(all, new RegExp(`${token}:\\s*\\d+ms`), `${token} is missing`);
    }
  });
});

describe('reduced motion', () => {
  const block = all.slice(all.indexOf('@media (prefers-reduced-motion: reduce)'));

  it('keeps colour and opacity instead of deleting all feedback', () => {
    assert.match(block, /transition-property:\s*opacity/);
    assert.equal(/transition:\s*none\s*!important/.test(block), false);
  });

  it('still cross-fades a dialog', () => {
    assert.match(block, /reduced-fade-in/);
    assert.match(block, /reduced-fade-out/);
  });

  it('stops the skeleton pulsing', () => {
    assert.match(block, /\.skeleton__bar\s*\{[\s\S]*?animation:\s*none/);
  });
});

describe('typography', () => {
  it('gives small text leading rather than setting it solid', () => {
    // The size is expressed in rem since the type audit; the assertion is about
    // the line-height, so both units are accepted rather than pinning one.
    const match = strip(css['tokens.css']).match(/--fine-print:\s*400\s+[\d.]+(?:px|rem)\/([\d.]+)/);
    assert.ok(match, '--fine-print not found');
    assert.ok(Number(match[1]) >= 1.3, `fine print line-height is ${match[1]}, expected >= 1.3`);
  });

  it('caps the measure on prose', () => {
    assert.match(strip(css['tokens.css']), /--measure:\s*68ch/);
    assert.match(all, /max-width:\s*var\(--measure\)/);
  });
});

describe('targets', () => {
  it('gives the language switch a real height', () => {
    const rule = all.slice(all.indexOf('.locale-switch__option {'));
    const height = rule.match(/min-height:\s*(\d+)px/);
    assert.ok(height, 'no min-height on the language switch');
    assert.ok(Number(height[1]) >= 24, `switch is ${height[1]}px tall, WCAG 2.5.8 wants 24`);
  });

  it('gives a coarse pointer the full 44', () => {
    assert.match(all, /@media \(pointer: coarse\)[\s\S]{0,200}min-height:\s*44px/);
  });
});

describe('the frame survives loading', () => {
  it('renders the shell, not the word, while the session resolves', () => {
    assert.match(app, /if \(loading\) return <ShellSkeleton[^>]*\/>/);
    assert.match(app, /function ShellSkeleton/);
    // The old full-page word is gone from the shell.
    assert.equal(/<div className="auth">\s*<p className="body muted">/.test(app), false);
  });

  it('uses skeletons for the lists that wait', () => {
    for (const route of ['Seeders.tsx', 'Turns.tsx', 'Torrents.tsx']) {
      const source = readFileSync(join(ROOT, 'routes', route), 'utf-8');
      assert.match(source, /SkeletonRows/, `${route} does not use the skeleton`);
      assert.equal(
        /<p className="body muted">\{t\('app\.loading'\)\}<\/p>/.test(source),
        false,
        `${route} still renders the word`,
      );
    }
  });
});

describe('the phone gets a drawer, not a stacked sidebar', () => {
  const mobile = all.slice(all.indexOf('@media (max-width: 1024px)'));

  it('moves the nav into a fixed drawer with a scrim', () => {
    assert.match(mobile, /\.shell__aside\s*\{[\s\S]*?display:\s*none/);
    assert.match(mobile, /\.shell__topbar\s*\{[\s\S]*?display:\s*flex/);
    assert.match(mobile, /\.shell__drawer\s*\{[\s\S]*?display:\s*block/);
    assert.match(all, /\.shell__scrim\s*\{[\s\S]*?position:\s*fixed/);
    assert.match(
      all,
      /\.shell__drawer--open \.shell__panel\s*\{[\s\S]*?transform:\s*translateX\(0\)/,
    );
  });

  it('keeps the menu and close controls full size', () => {
    assert.match(all, /\.shell__menu,\s*\n\.shell__close\s*\{[\s\S]*?min-height:\s*44px/);
  });

  it('traps and releases focus like a dialog', () => {
    assert.match(app, /event\.key === 'Escape'/);
    assert.match(app, /event\.key !== 'Tab'/);
    assert.match(app, /document\.body\.style\.overflow = 'hidden'/);
    assert.match(app, /menuButton\.current\?\.focus\(\)/);
  });

  it('still fades the panel when reduced motion is requested', () => {
    assert.match(
      all,
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.shell__panel[\s\S]*?transform:\s*none/,
    );
  });
});

describe('buttons and dialogs', () => {
  it('shows a spinner in the icon slot instead of changing the label', () => {
    assert.match(components, /busy = false/);
    assert.match(components, /Spinner/);
    assert.match(components, /btn__icon/);
  });

  it('anchors the dialog to its trigger and exits the way it entered', () => {
    assert.match(modal, /transformOrigin/);
    assert.match(modal, /modal--closing/);
    assert.match(modal, /aria-labelledby="modal-title"/);
    assert.match(all, /@keyframes modal-in/);
    assert.match(all, /@keyframes modal-out/);
  });
});
