import { gun, SEA } from './index';
import { PAIRING_TTL_MS, type PairingTicket } from './pairing-ticket';

export { encodeTicket, parseTicket, PAIRING_TTL_MS } from './pairing-ticket';
export type { PairingTicket } from './pairing-ticket';

/**
 * Linking a device without putting the account key in a QR code.
 *
 * The QR carries a throwaway ECDSA pair. The real account pair is encrypted to
 * that throwaway key and parked on the relay under a random id for two minutes.
 * Scanning the QR therefore hands over a sealed envelope plus its one-time
 * opener, not the account key itself; once opened, the envelope is deleted.
 *
 * Anyone who photographs the QR inside the window still gets the account — that
 * is the nature of linking a device. What this buys is a short, revocable,
 * single-use window instead of a permanent key printed on screen.
 */
const PAIRING_ROOT = 'open-tilawa-pairing';

export async function createPairingTicket(accountPair: unknown): Promise<PairingTicket> {
  if (!SEA?.pair) throw new Error('SEA unavailable');
  if (!accountPair) throw new Error('Sign in on this device first');

  const ephemeral = await SEA.pair();
  const sealed = await SEA.encrypt(JSON.stringify(accountPair), ephemeral);
  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `pair_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  const exp = Date.now() + PAIRING_TTL_MS;

  gun.get(PAIRING_ROOT).get(id).put({ sealed, exp });

  return { v: 2, id, epub: ephemeral.epub, epriv: ephemeral.epriv, exp };
}

/** Burns the envelope, whether or not the scan succeeded. */
export function discardTicket(id: string): void {
  try {
    gun.get(PAIRING_ROOT).get(id).put(null);
  } catch {
    // the expiry check on the receiving side is the backstop
  }
}

export async function redeemTicket(ticket: PairingTicket): Promise<unknown> {
  if (ticket.exp < Date.now()) throw new Error('Pairing code expired');

  const node = gun.get(PAIRING_ROOT).get(ticket.id);
  const record = await new Promise<{ sealed?: string; exp?: number } | null>((resolve) => {
    node.once((data: any) => resolve(data ?? null));
  });

  if (!record?.sealed) throw new Error('Pairing code expired or already used');
  if (typeof record.exp === 'number' && record.exp < Date.now()) {
    discardTicket(ticket.id);
    throw new Error('Pairing code expired');
  }

  const opened = await SEA.decrypt(record.sealed, {
    epub: ticket.epub,
    epriv: ticket.epriv,
  });
  const accountPair = typeof opened === 'string' ? JSON.parse(opened) : opened;
  if (!accountPair?.pub) throw new Error('Pairing code could not be opened');

  discardTicket(ticket.id);
  return accountPair;
}
