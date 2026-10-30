import assert from 'node:assert/strict';
import { test } from 'node:test';

import { PAIRING_TIMEOUT_MESSAGE } from '../src/gun/pairing-ticket.ts';
import { MESSAGES } from '../src/i18n/messages.ts';
import { pairingErrorCopy } from '../src/utils/pairing-error.ts';

const copy = MESSAGES.ar.account;

test('a code that expired or was already used asks for a new code', () => {
  assert.equal(pairingErrorCopy(new Error('Pairing code expired'), copy), copy.manualInvalid);
  assert.equal(
    pairingErrorCopy(new Error('Pairing code expired or already used'), copy),
    copy.manualInvalid,
  );
});

test('a relay that never answered is a network problem, not a bad code', () => {
  const error = new Error(PAIRING_TIMEOUT_MESSAGE);
  assert.equal(pairingErrorCopy(error, copy), copy.codeTimeout);
  assert.notEqual(copy.codeTimeout, copy.manualInvalid);
});

test('a string rejection is read the same way, because another layer threw it', () => {
  assert.equal(pairingErrorCopy(PAIRING_TIMEOUT_MESSAGE, copy), copy.codeTimeout);
  assert.equal(pairingErrorCopy('Pairing code could not be opened', copy), copy.codeFailed);
});

test('an unknown failure is a retry, never an invented cause', () => {
  assert.equal(pairingErrorCopy(new Error('boom'), copy), copy.codeFailed);
  assert.equal(pairingErrorCopy(null, copy), copy.codeFailed);
  assert.equal(pairingErrorCopy(undefined, copy), copy.codeFailed);
});
