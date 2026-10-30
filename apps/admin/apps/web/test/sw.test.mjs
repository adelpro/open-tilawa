import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const WEB = new URL('..', import.meta.url).pathname;
const sw = readFileSync(join(WEB, 'public', 'sw.js'), 'utf-8');

describe('service worker', () => {
  it('precaches only what a deploy cannot change under it', () => {
    // The manifest carries the window chrome. `cache.addAll` copies it once and
    // `caches.match` answers every later request from that copy, so a colour
    // change shipped with an unchanged cache name never reaches the browser.
    const shell = sw.match(/const SHELL = \[([^\]]*)\]/)?.[1] ?? '';
    assert.ok(!shell.includes('manifest.webmanifest'), 'the manifest is fetched, not precached');
    assert.ok(shell.includes("'/'"), 'the shell still has the page it falls back to');
  });
});
