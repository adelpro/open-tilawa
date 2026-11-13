import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { PALETTES } from '../src/utils/palettes.ts';

/**
 * The palette is CSS, and the picker's swatch is TS. Neither can read the other
 * at runtime, so this test is the joint: it fails when one side changes alone.
 */
const CSS = readFileSync(new URL('../src/app/globals.css', import.meta.url), 'utf8');

const REQUIRED = [
  '--bg',
  '--ink',
  '--muted',
  '--line',
  '--invert',
  '--surface',
  '--wave-front',
  '--wave-back',
];

function block(selector: string): string {
  const start = CSS.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `no \`${selector}\` block in globals.css`);
  const open = CSS.indexOf('{', start);
  const close = CSS.indexOf('}', open);
  return CSS.slice(open + 1, close);
}

function tokens(selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of block(selector).split('\n')) {
    const match = /^\s*(--[a-z-]+):\s*([^;]+);/.exec(line);
    if (match) out[match[1]] = match[2].trim();
  }
  return out;
}

/** WCAG 2.x relative luminance for a six-digit hex. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

test('the default palette is still the original one', () => {
  // "Keep the original theme" is the reason this feature exists; a retokened
  // default would silently change every existing listener's screen.
  const light = tokens(':root');
  const dark = tokens("[data-theme='dark']");
  assert.equal(light['--bg'], '#ffffff');
  assert.equal(light['--ink'], '#111111');
  assert.equal(light['--wave-front'], '#1c4d78');
  assert.equal(dark['--bg'], '#0b0b0c');
  assert.equal(dark['--wave-front'], '#a6c9ec');
});

test('every palette after the default declares the full token set in both modes', () => {
  for (const palette of PALETTES) {
    if (palette.id === 'default') continue;
    for (const selector of [`[data-palette='${palette.id}']`, `[data-palette='${palette.id}'][data-theme='dark']`]) {
      const declared = tokens(selector);
      for (const token of REQUIRED) {
        assert.match(declared[token] ?? '', /^#[0-9a-f]{6}$/i, `${selector} is missing ${token}`);
      }
    }
  }
});

test('a palette never recolours status or danger', () => {
  for (const palette of PALETTES) {
    if (palette.id === 'default') continue;
    for (const token of ['--danger', '--success', '--error', '--warning']) {
      for (const selector of [`[data-palette='${palette.id}']`, `[data-palette='${palette.id}'][data-theme='dark']`]) {
        assert.equal(tokens(selector)[token], undefined, `${selector} must not redeclare ${token}`);
      }
    }
  }
});

test('palettes are declared after the dark block, so the cascade cannot miss', () => {
  const dark = CSS.indexOf("[data-theme='dark'] {");
  for (const palette of PALETTES) {
    if (palette.id === 'default') continue;
    const light = CSS.indexOf(`[data-palette='${palette.id}'] {`);
    assert.ok(light > dark, `[data-palette='${palette.id}'] must come after the dark block`);
  }
});

test('every palette is legible in both modes', () => {
  for (const palette of PALETTES) {
    const pairs =
      palette.id === 'default'
        ? [tokens(':root'), tokens("[data-theme='dark']")]
        : [tokens(`[data-palette='${palette.id}']`), tokens(`[data-palette='${palette.id}'][data-theme='dark']`)];

    for (const set of pairs) {
      const page = set['--bg'];
      assert.ok(contrast(set['--ink'], page) >= 12, `${palette.id}: ink under 12:1 on ${page}`);
      assert.ok(contrast(set['--muted'], page) >= 4.5, `${palette.id}: muted under 4.5:1 on ${page}`);
      // The spectrum is data, not text, but it is the only hue on the page and
      // it carries the visualiser: it holds the same bar as body ink.
      assert.ok(contrast(set['--wave-front'], page) >= 7, `${palette.id}: wave-front under 7:1 on ${page}`);
    }
  }
});

test('the picker swatch is the palette the CSS paints', () => {
  for (const palette of PALETTES) {
    const light = palette.id === 'default'
      ? tokens(':root')
      : tokens(`[data-palette='${palette.id}']`);
    const dark = palette.id === 'default'
      ? tokens("[data-theme='dark']")
      : tokens(`[data-palette='${palette.id}'][data-theme='dark']`);

    assert.equal(palette.light.paper, light['--bg'], `${palette.id}: light swatch paper drifted`);
    assert.equal(palette.light.ink, light['--ink'], `${palette.id}: light swatch ink drifted`);
    assert.equal(palette.dark.paper, dark['--bg'], `${palette.id}: dark swatch paper drifted`);
    assert.equal(palette.dark.ink, dark['--ink'], `${palette.id}: dark swatch ink drifted`);
  }
});

test('the list is short, unique and starts with the original', () => {
  assert.equal(PALETTES[0].id, 'default');
  assert.ok(PALETTES.length <= 5, 'the paper list is capped at five');
  assert.equal(new Set(PALETTES.map((p) => p.id)).size, PALETTES.length);
});
