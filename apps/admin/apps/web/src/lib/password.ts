/**
 * The password rules, mirrored from the API.
 *
 * `apps/api/src/auth/dtos/password.policy.ts` is the authority — it is what a signup,
 * a reset and a password change are all validated against. The dashboard needs the same
 * numbers to say "eight characters" and to score a password as it is typed, so they are
 * repeated here; `test/password.test.mjs` reads the API file and fails if the two drift.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Case-sensitive on purpose: the API counts an uppercase letter as one. */
export const PASSWORD_RULES = {
  length: PASSWORD_MIN_LENGTH,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /\d/,
  common: [
    'password',
    '123456',
    '123456789',
    'qwerty',
    'azerty',
    'qwerty123',
    'azerty123',
    'abc123',
  ],
} as const;

export type PasswordRule = 'length' | 'upper' | 'lower' | 'digit' | 'common';

export interface PasswordCheck {
  rule: PasswordRule;
  met: boolean;
}

/**
 * Every rule, checked, in the order the API states them.
 *
 * `common` is a rule like any other: `Password123` satisfies the other four and is still
 * refused, so the meter must say why rather than call it strong.
 */
export function checkPassword(value: string): PasswordCheck[] {
  return [
    { rule: 'length', met: value.length >= PASSWORD_RULES.length },
    { rule: 'upper', met: PASSWORD_RULES.upper.test(value) },
    { rule: 'lower', met: PASSWORD_RULES.lower.test(value) },
    { rule: 'digit', met: PASSWORD_RULES.digit.test(value) },
    {
      rule: 'common',
      met:
        value.length > 0 &&
        !PASSWORD_RULES.common.some((word) => value.toLowerCase().includes(word)),
    },
  ];
}

export interface PasswordScore {
  checks: PasswordCheck[];
  /** 0 (nothing typed) to 4 (every rule met). */
  level: 0 | 1 | 2 | 3 | 4;
  met: number;
}

/**
 * The score is the count of rules met, mapped onto four steps, so a password cannot reach
 * "strong" while one rule is still open — the alternative (a length-only score) calls
 * `aaaaaaaaaaaa` a strong password.
 */
export function scorePassword(value: string): PasswordScore {
  if (value.length === 0) return { checks: checkPassword(''), level: 0, met: 0 };
  const checks = checkPassword(value);
  const met = checks.filter((check) => check.met).length;
  const level = (met <= 2 ? 1 : met === 3 ? 2 : met === 4 ? 3 : 4) as PasswordScore['level'];
  return { checks, level, met };
}
