import assert from 'node:assert/strict';
import { test } from 'node:test';

import { torrentLinkHref } from '../src/utils/torrent-link.ts';

/**
 * The magnet becomes an `href`, so the scheme is a security boundary and not a
 * formatting detail: the catalogue is editable from the console, and a string
 * there must never turn into a navigation primitive the browser will execute.
 */
test('a magnet link is used as written', () => {
  assert.equal(
    torrentLinkHref('magnet:?xt=urn:btih:465aa4a5cc2dafe86cd616f1dc9e94b1dce36496'),
    'magnet:?xt=urn:btih:465aa4a5cc2dafe86cd616f1dc9e94b1dce36496',
  );
});

test('surrounding whitespace is trimmed, not copied into the link', () => {
  assert.equal(torrentLinkHref('  magnet:?xt=urn:btih:abc  '), 'magnet:?xt=urn:btih:abc');
});

test('anything that is not a magnet is not a link', () => {
  assert.equal(torrentLinkHref('https://example.org/file.torrent'), null);
  assert.equal(torrentLinkHref('javascript:alert(1)'), null);
  assert.equal(torrentLinkHref('data:text/plain,magnet:?x'), null);
});

test('a bare scheme with nothing after it is not a link', () => {
  assert.equal(torrentLinkHref('magnet:'), null);
  assert.equal(torrentLinkHref('magnet:?'), null);
});

test('an absent magnet is nothing, not an empty link', () => {
  assert.equal(torrentLinkHref(''), null);
  assert.equal(torrentLinkHref('   '), null);
  assert.equal(torrentLinkHref(null), null);
  assert.equal(torrentLinkHref(undefined), null);
});
