import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  consentEnabled,
  readConsent,
  shouldPrompt,
  writeConsent,
  type Consent,
} from '../src/utils/telemetry-consent.ts';

const store = (value: string | null) => {
  let held = value;
  return {
    getItem: () => held,
    setItem: (_: string, next: string) => {
      held = next;
    },
    value: () => held,
  };
};

test('the question is never asked before sound has played', () => {
  assert.equal(shouldPrompt('unset', false), false);
});

test('it is asked once, after the first playback', () => {
  assert.equal(shouldPrompt('unset', true), true);
});

test('it is never asked twice, whatever the answer was', () => {
  assert.equal(shouldPrompt('on', true), false);
  assert.equal(shouldPrompt('off', true), false);
});

test('an unreadable or absent answer means unset, never on', () => {
  assert.equal(readConsent(store(null)), 'unset');
  assert.equal(readConsent(store('yes')), 'unset');
  assert.equal(readConsent(store('garbage')), 'unset');
});

test('the answer survives a reload', () => {
  const s = store(null);
  writeConsent('off', s);
  assert.equal(s.value(), 'off');
  assert.equal(readConsent(s), 'off');
});

test('only an explicit yes turns collection on', () => {
  const states: Consent[] = ['unset', 'off', 'on'];
  assert.deepEqual(states.filter(consentEnabled), ['on']);
});
