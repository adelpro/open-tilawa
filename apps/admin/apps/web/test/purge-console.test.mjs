import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { SCREENS, consoleUrls, purge } from '../scripts/purge-console.mjs';

/**
 * The console's purge list, and the thing that keeps it honest.
 *
 * The list is hand-kept because the router's paths live in the source rather than in
 * build output. A screen added without a line here keeps serving yesterday's shell
 * from the edge — the failure that shipped a blank console for an hour — so the last
 * test reads the source and fails when it finds a route this file does not name.
 */
const SRC = new URL('../src/', import.meta.url).pathname;

function sources(dir = SRC) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) files.push(...sources(path));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(path);
  }
  return files;
}

describe('consoleUrls', () => {
  it('covers the shell, the prerendered pages and every screen', () => {
    const urls = consoleUrls('https://console.example');
    assert.ok(urls.includes('https://console.example/'));
    for (const path of ['/about', '/privacy', '/terms']) {
      assert.ok(urls.includes(`https://console.example${path}`), path);
    }
    for (const screen of SCREENS) {
      assert.ok(urls.includes(`https://console.example${screen}`), screen);
    }
  });

  it('never repeats a URL', () => {
    const urls = consoleUrls('https://console.example');
    assert.equal(new Set(urls).size, urls.length);
  });
});

describe('purge', () => {
  it('posts thirty files per call', async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url, files: JSON.parse(init.body).files });
      return { ok: true, status: 200, json: async () => ({ success: true, errors: [] }) };
    };

    const urls = Array.from({ length: 45 }, (_, index) => `https://x/${index}`);
    const result = await purge(urls, { token: 'token', zone: 'zone', fetchImpl });

    assert.equal(result.purged, 45);
    assert.deepEqual(
      calls.map((call) => call.files.length),
      [30, 15],
    );
    assert.match(calls[0].url, /zones\/zone\/purge_cache$/);
  });

  it('refuses to report success after a rejected batch', async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ success: false, errors: [{ code: 1 }] }),
    });

    await assert.rejects(
      () => purge(['https://x/1'], { token: 'token', zone: 'zone', fetchImpl }),
      /purge failed after 0\/1/,
    );
  });
});

describe('the purge list matches the router', () => {
  it('names every /console route the source contains', () => {
    const literals = new Set();
    for (const file of sources()) {
      for (const match of readFileSync(file, 'utf-8').matchAll(/'(\/console[^']*)'/g)) {
        literals.add(match[1].replace(/\/$/, '') || '/console');
      }
    }

    const missing = [...literals].filter((path) => !SCREENS.includes(path));
    assert.deepEqual(missing, [], `purge-console.mjs does not name: ${missing.join(', ')}`);
  });
});
