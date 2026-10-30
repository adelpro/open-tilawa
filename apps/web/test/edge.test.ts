import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

/**
 * The edge is the only layer that knows which host a response is for.
 *
 * Production and the preview channel run the same bundle, so nothing inside the build can
 * tell them apart: the prerendered pages carry `canonical` → tilawah.cc, which is a hint a
 * crawler is free to ignore, and a share link to staging.tilawah.cc would then be indexed
 * as a second copy of the site. The response header is authoritative and covers every
 * response, HTML or asset. Asserted against the template the edge renders at start.
 *
 * The file lives outside apps/web on purpose: the vhost and the bundle are one contract,
 * and the web test suite is the only runner that executes config tests.
 */
const TEMPLATE = readFileSync(
  new URL('../../../edge/templates/default.conf.template', import.meta.url),
  'utf-8',
);

/** A `server { … }` block, from its `server_name` to the next line that closes it. */
function vhost(anchor: string): string {
  const start = TEMPLATE.indexOf(anchor);
  assert.ok(start > -1, `no vhost anchored on \`${anchor}\``);
  const end = TEMPLATE.indexOf('\n}', start);
  return TEMPLATE.slice(start, end === -1 ? undefined : end);
}

test('the preview channel tells a crawler not to index it', () => {
  assert.match(
    vhost('server_name staging.tilawah.cc;'),
    /add_header X-Robots-Tag "noindex[^"]*" always;/,
    'staging has no X-Robots-Tag: the only signal is a canonical, which is advisory',
  );
});

test('production stays indexable', () => {
  // A header copied into the site's own vhost would de-index tilawah.cc.
  assert.doesNotMatch(vhost('server_name _ tilawah.cc;'), /X-Robots-Tag/);
});
