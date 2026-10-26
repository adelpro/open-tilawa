import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * The dashboard's password rules mirror the API's.
 *
 * Two copies of a rule is a bug waiting to be found by a user, so this file makes the drift
 * loud: it reads `apps/api/src/auth/dtos/password.policy.ts` and fails if the length, the
 * pattern or the common-password list have moved. The scoring is then checked against the
 * API's own pattern rather than against the implementation's opinion of itself.
 */
const ROOT = new URL('../src/', import.meta.url).pathname;
const API_POLICY = readFileSync(
  join(ROOT, '..', '..', 'api', 'src', 'auth', 'dtos', 'password.policy.ts'),
  'utf-8',
);

/** The same source text the API compiles. Copying it here is the assertion, not the risk. */
const API_PATTERN_SOURCE = '^(?=.*\\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$';

// Node strips the type annotations on import (22.6+), so the module under test is the one
// the browser gets — no build step, and no second copy of the rules.
const { checkPassword, scorePassword, PASSWORD_MIN_LENGTH, PASSWORD_RULES } =
  await import('../src/lib/password.ts');

describe('the rules match the API', () => {
  it('has the same minimum length', () => {
    const match = API_POLICY.match(/PASSWORD_MIN_LENGTH = (\d+)/);
    assert.ok(match, 'PASSWORD_MIN_LENGTH not found in the API policy');
    assert.equal(Number(match[1]), PASSWORD_MIN_LENGTH);
  });

  it('has the same pattern', () => {
    assert.ok(
      API_POLICY.includes(API_PATTERN_SOURCE),
      'the API pattern changed — update apps/web/src/lib/password.ts to match',
    );
    const pattern = new RegExp(API_PATTERN_SOURCE);
    for (const sample of [
      'Password1',
      'password1',
      'PASSWORD1',
      'Password',
      'Pass1',
      'Password123',
    ]) {
      const apiAccepts = pattern.test(sample);
      const dashboardAccepts = ['length', 'upper', 'lower', 'digit'].every(
        (rule) => checkPassword(sample).find((check) => check.rule === rule)?.met,
      );
      assert.equal(
        dashboardAccepts,
        apiAccepts,
        `${sample}: API ${apiAccepts}, dashboard ${dashboardAccepts}`,
      );
    }
  });

  it('has the same list of common passwords', () => {
    for (const word of PASSWORD_RULES.common) {
      assert.ok(API_POLICY.includes(`'${word}'`), `${word} is not refused by the API`);
    }
  });
});

describe('scoring', () => {
  const level = (value) => scorePassword(value).level;

  it('is zero while nothing is typed', () => {
    assert.equal(level(''), 0);
  });

  it('never reaches the top while a rule is open', () => {
    assert.ok(level('aaaaaaaaaaaa') < 4, 'lowercase only scored strong');
    assert.ok(level('Aaaa1aa') < 4, 'seven characters scored strong');
    assert.ok(level('NoDigitsHere') < 4, 'a password without a number scored strong');
  });

  it('scores the top step when every rule is met — the API would accept it too', () => {
    // Eight characters with all four classes satisfies the server's pattern, so the meter says
    // so. A meter with a stricter private opinion would refuse nothing and teach the wrong thing.
    assert.equal(level('Aaaa1aaa'), 4);
  });

  it('reserves the top step for a password with every rule met', () => {
    assert.equal(level('Tr0ub4dor&3'), 4);
  });

  it('treats a common password as an unmet rule, not a strong one', () => {
    const score = scorePassword('Password123');
    assert.equal(score.checks.find((check) => check.rule === 'common')?.met, false);
    assert.ok(score.level < 4);
  });

  it('reports which rule is still open, in order', () => {
    const open = checkPassword('abc')
      .filter((check) => !check.met)
      .map((check) => check.rule);
    assert.deepEqual(open, ['length', 'upper', 'digit']);
  });
});
