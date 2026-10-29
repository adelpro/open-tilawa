import assert from 'node:assert/strict';
import { test } from 'node:test';

import { paramsFromHash, routeFromHash } from '../src/hooks/use-hash-route.ts';

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

test('the query is read from the hash, never from the document search', () => {
  assert.equal(paramsFromHash('#/?view=favorites').get('view'), 'favorites');
  assert.equal(paramsFromHash('#/?view=favorites').get('nope'), null);
  assert.equal(paramsFromHash('#').get('view'), null);
  assert.equal(paramsFromHash('').get('view'), null);
  // The route is unaffected by the query it carries.
  assert.equal(routeFromHash('#/?view=favorites'), '/');
});
