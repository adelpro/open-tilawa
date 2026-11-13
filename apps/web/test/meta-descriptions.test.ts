import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MESSAGES } from '../src/i18n/messages.ts';

/**
 * A search result keeps roughly 160 characters, and three pages sharing one
 * description tell a crawler they are the same page. The prerenderer used to take
 * the About lede for the home, About and Privacy heads; each page now owns a
 * shorter sentence of its own.
 */
const SNIPPET = 160;

test('every page describes itself in its own snippet', () => {
  for (const locale of ['ar', 'en'] as const) {
    const copy = MESSAGES[locale];
    const pages = {
      home: copy.home.description,
      about: copy.about.description,
      privacy: copy.privacy.description,
    };

    const seen = new Set<string>();
    for (const [name, description] of Object.entries(pages)) {
      assert.ok(description.trim().length > 0, `${locale}/${name}: empty description`);
      assert.equal(description, description.trim(), `${locale}/${name}: outer whitespace`);
      assert.ok(
        description.length <= SNIPPET,
        `${locale}/${name}: ${description.length} characters, a result keeps about ${SNIPPET}`,
      );
      assert.ok(seen.has(description) === false, `${locale}/${name}: same text as another page`);
      seen.add(description);
    }
  }
});

/**
 * The heading a reader sees is not the `<title>`: a pipe belongs in the tab, and
 * the route table already gives the page its title through `pageTitle()`.
 */
test('the page heading carries no document-title punctuation', () => {
  for (const locale of ['ar', 'en'] as const) {
    assert.doesNotMatch(MESSAGES[locale].about.title, /[|–—]/, `${locale}: title punctuation in the h1`);
  }
});
