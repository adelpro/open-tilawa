import assert from 'node:assert/strict';
import test from 'node:test';

import { createSheetLayer } from '@/utils/sheet-layer';

/**
 * A stand-in for `window.history`: it records what the layer asked for, so a
 * test can assert on the sequence instead of on a browser.
 */
function harness() {
  const calls: string[] = [];
  let state: unknown = { app: true };
  let href = 'https://tilawa/';
  let queued: (() => void)[] = [];

  const layer = createSheetLayer({
    push: () => {
      calls.push('push');
      state = { tilawaSheet: true };
    },
    back: () => {
      calls.push('back');
      state = { app: true };
    },
    state: () => state,
    href: () => href,
    schedule: (run) => {
      queued.push(run);
    },
  });

  return {
    layer,
    calls,
    flush: () => {
      const due = queued;
      queued = [];
      for (const run of due) run();
    },
    pop: () => {
      state = { app: true };
    },
    setHref: (next: string) => {
      href = next;
    },
  };
}

test('a handover between two sheets leaves one entry and never unwinds', () => {
  const { layer, calls, flush } = harness();

  // The menu hands over to the account sheet inside one commit: React closes
  // the menu's effect before it opens the account's.
  layer.acquire('menu', () => undefined);
  layer.release('menu');
  layer.acquire('account', () => undefined);
  flush();

  assert.deepEqual(calls, ['push']);
});

test('closing the only sheet unwinds the entry it pushed', () => {
  const { layer, calls, flush } = harness();

  layer.acquire('account', () => undefined);
  layer.release('account');
  flush();

  assert.deepEqual(calls, ['push', 'back']);
});

test('two sheets share one entry, and it is unwound once', () => {
  const { layer, calls, flush } = harness();

  layer.acquire('menu', () => undefined);
  layer.acquire('account', () => undefined);
  layer.release('account');
  layer.release('menu');
  flush();

  assert.deepEqual(calls, ['push', 'back']);
});

test('a sheet that lost its entry does not go back', () => {
  const { layer, calls, flush, pop } = harness();

  layer.acquire('account', () => undefined);
  pop(); // the browser already left the sheet entry
  layer.release('account');
  flush();

  assert.deepEqual(calls, ['push']);
});

test('a route change never drags the browser back out of it', () => {
  const { layer, calls, flush, setHref } = harness();

  layer.acquire('account', () => undefined);
  setHref('https://tilawa/#/about');
  layer.release('account');
  flush();

  assert.deepEqual(calls, ['push']);
});

test('one pop dismisses the top sheet only, even with a listener each', () => {
  const closes: string[] = [];
  const { layer, pop, flush } = harness();

  layer.acquire('menu', () => closes.push('menu'));
  layer.acquire('account', () => closes.push('account'));
  pop();

  // Every open sheet hears the same pop, inside one task.
  layer.popped();
  layer.popped();
  flush();

  assert.deepEqual(closes, ['account']);
});
