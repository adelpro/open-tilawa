import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The returning-devices read-out carries a count, not a date.
 *
 * The day was printed twice — beside the tile's label and again inside the devices
 * panel's sentence — and both read as "this is today's number" under a heading that
 * says "today". The share is the window's; naming a day next to it invited exactly
 * that misreading, so the date is gone from both surfaces. The window's own dates
 * still appear where they belong: the period table and the newest-report line.
 */
const usage = readFileSync(new URL('../src/routes/Usage.tsx', import.meta.url).pathname, 'utf-8');

describe('the returning-devices read-out', () => {
  it('prints no date beside the count', () => {
    assert.doesNotMatch(usage, /usage\.returningOn/);
    assert.doesNotMatch(usage, /stamp\?\.day/);
  });

  it('still prints the count', () => {
    assert.match(usage, /usage\.returningOf/);
  });
});
