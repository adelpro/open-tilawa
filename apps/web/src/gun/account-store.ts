import { STORAGE_KEYS, LEGACY_STORAGE_PREFIX } from '@/utils/storage-keys';

const KEY = STORAGE_KEYS.account;

/**
 * The account keypair, kept in this browser.
 *
 * Gun's `recall()` only ever writes to sessionStorage, so without this the
 * account died with the tab and the listener had to scan a pairing code again
 * every time they reopened the browser — the opposite of "the account lives on
 * this device". Anyone with access to this browser profile can read the key,
 * exactly as they could read a signed-in session cookie; signing out erases it.
 */
export type StoredPair = {
  pub: string;
  priv: string;
  epub: string;
  epriv: string;
};

export function readStoredPair(): StoredPair | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const pair = parsed as Partial<StoredPair> | null;
    if (!pair?.pub || !pair.priv || !pair.epub || !pair.epriv) return null;
    return pair as StoredPair;
  } catch {
    return null;
  }
}

export function storePair(pair: unknown): void {
  if (typeof window === 'undefined') return;
  const value = pair as Partial<StoredPair> | null;
  if (!value?.pub || !value.priv || !value.epub || !value.epriv) return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ pub: value.pub, priv: value.priv, epub: value.epub, epriv: value.epriv }),
    );
  } catch {
    // private mode: the account lasts for this session only
  }
}

export function clearStoredPair(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY);
    // The pre-rename key can still exist on a browser that has not booted the
    // new bundle since the migration ran. Signing out must forget the key
    // everywhere, not leave a copy under the old name.
    window.localStorage.removeItem(`${LEGACY_STORAGE_PREFIX}account`);
  } catch {
    // nothing to do
  }
}
