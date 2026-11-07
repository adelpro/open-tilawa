import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

/**
 * A screen string written into a component is invisible to the language
 * switcher: `/en` renders it in Arabic, and the message tree's English copy sits
 * unused. The sheets shipped with an Arabic title and search placeholder in both
 * locales for exactly that reason.
 *
 * The guard is narrow on purpose: only attributes a person reads or a screen
 * reader announces, and only Arabic literals — a component may legitimately
 * carry Arabic data (a surah name), never Arabic chrome.
 */
const ROOTS = ['src/components', 'src/app'];
const ARABIC = /[\u0600-\u06FF]/;
const ATTRIBUTE = /(?:title|placeholder|label|aria-label)="([^"]*)"/g;

function sources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sources(path));
    else if (path.endsWith('.tsx') || path.endsWith('.ts')) found.push(path);
  }
  return found;
}

test('visible copy comes from the message tree, not an Arabic literal', () => {
  const hits: string[] = [];
  for (const file of ROOTS.flatMap(sources)) {
    for (const [, value] of readFileSync(file, 'utf8').matchAll(ATTRIBUTE)) {
      if (ARABIC.test(value)) hits.push(`${file}: ${value}`);
    }
  }
  assert.deepEqual(hits, [], `Arabic literals in visible attributes:\n${hits.join('\n')}`);
});
