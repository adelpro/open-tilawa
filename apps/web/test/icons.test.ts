import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * The icon contract, as a test rather than a convention.
 *
 * Every rule here is one a reviewer would otherwise have to remember: one import
 * site, one size scale, one weight, and no glyph smuggled in as a character.
 */

const SRC = join(new URL('..', import.meta.url).pathname, 'src');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const sources = walk(SRC).filter((path) => /\.tsx?$/.test(path));

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Prose may name an arrow; code may not draw one. */
function code(path: string): string {
  return read(path)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

test('Phosphor is imported in exactly one place', () => {
  const importers = sources.filter(
    (path) =>
      read(path).includes("from '@phosphor-icons/react'") &&
      !path.endsWith('/components/icons.tsx'),
  );
  assert.deepEqual(
    importers.map((path) => path.replace(`${SRC}/`, '')),
    [],
    'a call site imported the icon library instead of the wrapper',
  );
});

test('icons are only 16, 20 or 24', () => {
  for (const path of sources) {
    for (const match of read(path).matchAll(/<Icon\b[^>]*?\bsize=\{(\d+)\}/g)) {
      const size = Number(match[1]);
      assert.ok([16, 20, 24].includes(size), `${path}: icon size ${size} is outside the scale`);
    }
  }
});

test('no icon is drawn with a character', () => {
  const glyphs = ['▾', '✎', '✓', '✕', '←', '→', '↑', '↓'];
  for (const path of sources.filter((file) => file.endsWith('.tsx'))) {
    // The keyboard help names the keys the listener presses; those are text.
    if (path.endsWith('player-page.tsx')) continue;
    const source = code(path);
    for (const glyph of glyphs) {
      assert.ok(!source.includes(glyph), `${path} drew ${glyph} as an icon`);
    }
  }
});

test('type is sized in rem, never px', () => {
  for (const path of sources) {
    assert.ok(!/text-\[\d+(\.\d+)?px\]/.test(read(path)), `${path} sizes text in px`);
  }
});

test('spacing never uses a half step', () => {
  for (const path of sources) {
    const source = read(path);
    const half = source.match(/(?:gap|p|px|py|pt|pb|ps|pe|m|mx|my|mt|mb|ms|me)-\d+\.5\b/g);
    assert.equal(half, null, `${path} uses a half-step spacing value: ${half?.join(', ')}`);
  }
});
