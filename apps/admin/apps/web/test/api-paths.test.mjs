import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The API helper owns the prefix.
 *
 * `api()` builds `/api${path}`, and every call site passes what follows — `/me`,
 * `/tokens`, `/seeders`. A screen that writes `/api/...` asks for `/api/api/...`, which
 * is a 404 the browser reports as "could not load", so the bug looks like the server.
 * The usage screen shipped with exactly that and nobody saw it until it was opened.
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

describe('api paths', () => {
  it('never double the /api prefix the helper adds', () => {
    const offenders = [];
    for (const file of sources()) {
      const source = readFileSync(file, 'utf-8');
      for (const match of source.matchAll(/\bapi(?:<[^>]*>)?\(\s*[`'"](\/api\/[^`'"]*)/g)) {
        offenders.push(`${file.replace(SRC, '')} → ${match[1]}`);
      }
    }
    assert.deepEqual(offenders, [], `these calls would hit /api/api/…: ${offenders.join(', ')}`);
  });
});
