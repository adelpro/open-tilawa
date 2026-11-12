import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The status card's reason line, pinned at the source.
 *
 * The console has no component renderer, so the two claims that matter are made
 * against the JSX: the detail is printed only for a service that failed (a
 * passing check's detail is "200", which must never read as a reason), and it is
 * held at LTR so a Latin status line cannot reorder the card in Arabic.
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const status = readFileSync(join(ROOT, 'routes/Status.tsx'), 'utf-8');

describe('the status card explains a failure', () => {
  it('prints the probe detail only while the service is down', () => {
    assert.match(status, /service\.ok === false && service\.detail/);
  });

  it('holds the reason at LTR so a status line cannot reorder the card', () => {
    assert.match(status, /<bdi dir="ltr">\{service\.detail\}<\/bdi>/);
  });
});
