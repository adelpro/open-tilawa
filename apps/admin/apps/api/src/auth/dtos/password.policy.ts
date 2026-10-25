/**
 * The one password policy, in one place.
 *
 * It lived in three: signup enforced a length and a character mix, sign-in enforced
 * a length it had no business enforcing, and password reset enforced nothing at all —
 * so the reset link could set a one-character password on an account that signup would
 * never have accepted. These constants are imported by every DTO that accepts a
 * password so the three cannot drift apart again.
 */

export const PASSWORD_MIN_LENGTH = 8;

/** At least one digit, one lower, one upper letter. */
export const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[a-zA-Z]).{8,}$/;

export const PASSWORD_PATTERN_MESSAGE =
  'Password must contain at least one uppercase letter, one lowercase letter and one number';

/** Passwords that are refused even when they satisfy the pattern. */
export const COMMON_PASSWORDS = [
  'password',
  '123456',
  '123456789',
  'qwerty',
  'azerty',
  'qwerty123',
  'azerty123',
  'abc123',
];
