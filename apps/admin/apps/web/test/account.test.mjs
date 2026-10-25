import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The account security screen.
 *
 * The password confirmation deliberately reuses the sign-up copy and the same
 * mismatch rule, so the two screens cannot drift into different wording or a
 * different definition of "the passwords match".
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const read = (path) => readFileSync(join(ROOT, path), 'utf-8');

const account = read('routes/Account.tsx');
const app = read('App.tsx');

describe('changing a password', () => {
  it('asks for the new password twice with the sign-up copy', () => {
    assert.match(account, /const \[confirmPassword, setConfirmPassword\]/);
    assert.match(account, /t\('signup\.confirmPassword'\)/);
    assert.match(account, /t\('signup\.confirmHint'\)/);
    assert.match(account, /confirmPassword !== newPassword|newPassword !== confirmPassword/);
    assert.match(account, /t\('signup\.mismatch'\)/);
    assert.match(account, /setConfirmPassword\(''\)/);
  });
});

describe('signed-in devices', () => {
  it('shows the API label, the current device and 2FA trust', () => {
    assert.match(account, /session\.label/);
    assert.match(account, /session\.isCurrent/);
    assert.match(account, /session\.isTrusted/);
    assert.match(account, /account\.devices\.thisDevice/);
    assert.match(account, /account\.devices\.trusted/);
  });

  it('offers a delete action that forgets the device trust', () => {
    assert.match(account, /account\.devices\.delete/);
    assert.match(account, /window\.confirm/);
    assert.match(account, /method: 'DELETE'/);
  });
});

describe('changing the account email', () => {
  it('asks for the new address and the current password before mailing a link', () => {
    assert.match(account, /\/me\/email-change/);
    assert.match(account, /newEmail/);
    assert.match(account, /account\.email\.title/);
    assert.match(account, /account\.password\.current/);
  });

  it('mounts the link landing route', () => {
    assert.match(app, /first === 'email-change'/);
  });
});

describe('owner safeguards', () => {
  it('badges the owner and explains why the account cannot be deleted', () => {
    assert.match(account, /user\?\.isOwner/);
    assert.match(account, /account\.owner\.deleteHint/);
    assert.match(account, /disabled=\{user\?\.isOwner \|\|/);
  });

  it('offers the transfer form and mounts its acceptance route', () => {
    assert.match(account, /\/me\/owner-transfer/);
    assert.match(account, /account\.owner\.transferAction/);
    assert.match(app, /first === 'owner-transfer'/);
  });
});
