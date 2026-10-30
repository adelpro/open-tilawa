/**
 * Whether to ask, and what the answer means.
 *
 * Asked once — never at first paint, where the question means nothing, but after the first
 * playback that actually produced sound. Whatever the answer, the question is not asked
 * again; the switch stays in Settings for anyone who changes their mind.
 */

import { STORAGE_KEYS } from '@/utils/storage-keys';

export type Consent = 'unset' | 'on' | 'off';

const KEY = STORAGE_KEYS.telemetry;

export function shouldPrompt(consent: Consent, heardSound: boolean): boolean {
  return consent === 'unset' && heardSound;
}

export function readConsent(storage: Pick<Storage, 'getItem'> = window.localStorage): Consent {
  try {
    const raw = storage.getItem(KEY);
    return raw === 'on' || raw === 'off' ? raw : 'unset';
  } catch {
    return 'unset';
  }
}

export function writeConsent(value: Consent, storage: Pick<Storage, 'setItem'> = window.localStorage): void {
  try {
    storage.setItem(KEY, value);
  } catch {
    // A full or disabled store means the question is asked again next time; it never
    // means the answer is invented.
  }
}

export function consentEnabled(consent: Consent): boolean {
  return consent === 'on';
}
