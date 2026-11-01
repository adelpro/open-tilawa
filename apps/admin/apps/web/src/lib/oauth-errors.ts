import type { MessageKey } from './i18n';

/**
 * The provider failure codes, mapped to the sentence that explains them.
 *
 * One table for both screens: Sign-in reads `?error=` from the callback, Account
 * reads it after a link attempt. The sentences are deliberately different — "the
 * provider could not complete" leaves a person with no idea whether to retry, use a
 * password, or ask for help, while an address that already has an account has a
 * specific answer.
 */
export const OAUTH_ERROR_KEYS: Record<string, MessageKey> = {
  account_exists: 'auth.error.account_exists',
  unverified_email: 'auth.error.unverified_email',
  identity_taken: 'auth.error.identity_taken',
  account_disabled: 'auth.error.account_disabled',
  state_invalid: 'auth.error.state_invalid',
  provider_disabled: 'auth.error.provider_disabled',
  provider_error: 'auth.error.provider_error',
  setup_required: 'auth.error.setup_required',
};

export const oauthErrorKey = (code: string | null | undefined): MessageKey =>
  (code && OAUTH_ERROR_KEYS[code]) || 'auth.error.provider_error';
