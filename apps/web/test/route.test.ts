import assert from 'node:assert/strict';
import { test } from 'node:test';

import { routeFromHash } from '../src/hooks/use-hash-route.ts';

test('the hash decides the route', () => {
  assert.equal(routeFromHash(''), '/');
  assert.equal(routeFromHash('#'), '/');
  assert.equal(routeFromHash('#/'), '/');
  assert.equal(routeFromHash('#/about'), '/about');
  assert.equal(routeFromHash('#/privacy'), '/privacy');
});

test('query strings and missing slashes are tolerated', () => {
  assert.equal(routeFromHash('#/about?from=menu'), '/about');
  assert.equal(routeFromHash('#about'), '/about');
});

test('an unknown route falls back to the player', () => {
  assert.equal(routeFromHash('#/reciter/1/2'), '/');
  assert.equal(routeFromHash('#/nope'), '/');
});
