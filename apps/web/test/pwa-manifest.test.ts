import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { PWA_SCREENSHOTS, PWA_SHORTCUTS } from '../src/constants/pwa.ts';
import { ROUTE_TABLE } from '../src/routes.ts';

const PUBLIC = fileURLToPath(new URL('../public/', import.meta.url));

/** A PNG's real size, read from the IHDR chunk rather than trusted from config. */
function pngSize(src: string): { width: number; height: number } {
  const buffer = readFileSync(PUBLIC + src);
  assert.equal(buffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${src} is not a PNG`);

  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

test('every screenshot exists and its declared size is its real size', () => {
  for (const shot of PWA_SCREENSHOTS) {
    const { width, height } = pngSize(shot.src);
    // Chrome drops a mismatched entry without a word, so the manifest would
    // simply show nothing where a preview should be.
    assert.equal(shot.sizes, `${width}x${height}`, `${shot.src} declares the wrong size`);
    assert.equal(shot.type, 'image/png');
  }
});

test('form_factor matches the image orientation', () => {
  for (const shot of PWA_SCREENSHOTS) {
    const { width, height } = pngSize(shot.src);
    if (shot.form_factor === 'narrow') assert.ok(height > width, `${shot.src} must be portrait`);
    else assert.ok(width > height, `${shot.src} must be landscape`);
  }
});

test('the manifest keeps a phone shot and stays inside Chrome\'s limits', () => {
  assert.ok(PWA_SCREENSHOTS.some((shot) => shot.form_factor === 'narrow'));
  assert.ok(PWA_SCREENSHOTS.length <= 8, 'the manifest accepts at most 8 screenshots');
});

test('shortcuts stay in scope and point at real routes', () => {
  assert.ok(PWA_SHORTCUTS.length <= 4, 'Chrome shows at most four shortcuts');
  assert.equal(new Set(PWA_SHORTCUTS.map((s) => s.url)).size, PWA_SHORTCUTS.length);

  for (const shortcut of PWA_SHORTCUTS) {
    assert.ok(shortcut.url.startsWith('/'), `${shortcut.url} is outside scope`);
    assert.ok(shortcut.name.length > 0 && shortcut.short_name.length > 0);

    const route = shortcut.url.split('#')[1]?.split('?')[0] ?? '';
    assert.ok(
      ROUTE_TABLE.some((row) => row.pattern === (route === '' ? '/' : `/${route.replace(/^\//, '')}`)),
      `${shortcut.url} does not land on a route`,
    );

    for (const icon of shortcut.icons) statSync(PUBLIC + icon.src);
  }
});

test('a shortcut points at a path the app resolves, with no query in it', () => {
  for (const shortcut of PWA_SHORTCUTS) {
    // Personal state belongs in a path, not a query: `/favorites` is a real page the
    // router knows, and nothing about the listener ends up in an access log.
    assert.ok(!shortcut.url.includes('?'), `${shortcut.url} carries a query`);
    assert.ok(!shortcut.url.includes('#'), `${shortcut.url} still uses the hash router`);
  }
});
