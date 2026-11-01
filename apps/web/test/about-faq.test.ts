import assert from 'node:assert/strict';
import { test } from 'node:test';

import { MESSAGES } from '../src/i18n/messages.ts';

/**
 * The About page's visible FAQ is also its `FAQPage` markup. A language that
 * drops a question, or a copy edit that empties an answer, would leave the two
 * audiences — reader and crawler — with different pages.
 */
test('both languages answer the same questions', () => {
  const ar = MESSAGES.ar.about.faq.items;
  const en = MESSAGES.en.about.faq.items;

  assert.equal(ar.length, en.length, 'the two languages answer different numbers of questions');
  assert.ok(ar.length >= 6, 'the FAQ should cover the six standing questions');

  for (const [name, items] of [
    ['ar', ar],
    ['en', en],
  ] as const) {
    for (const item of items) {
      assert.ok(item.q.trim().length > 5, `${name}: question too short: ${item.q}`);
      assert.ok(item.a.trim().length > 20, `${name}: answer too short: ${item.a}`);
      assert.equal(item.q, item.q.trim(), `${name}: question has outer whitespace`);
      assert.equal(item.a, item.a.trim(), `${name}: answer has outer whitespace`);
    }
  }
});
