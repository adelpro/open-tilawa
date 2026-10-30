import { PAIRING_TIMEOUT_MESSAGE } from '@/gun/pairing-ticket';
import type { Messages } from '@/i18n/messages';

/**
 * Why a redemption failed, in the listener's language.
 *
 * `pairing.ts` throws English messages for the console and for the test suite;
 * an Arabic screen showing "Pairing code expired or already used" is a bug the
 * listener cannot act on. Three outcomes need different advice: a dead code
 * means get a new one, a relay that did not answer means check the network,
 * and anything else is a retry.
 */
export function pairingErrorCopy(error: unknown, copy: Messages['account']): string {
  const text =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : '';

  if (text.includes(PAIRING_TIMEOUT_MESSAGE)) return copy.codeTimeout;
  if (/expired|already used/i.test(text)) return copy.manualInvalid;
  return copy.codeFailed;
}
