import type { MessageKey } from './i18n';

/**
 * The console's word for a play's source.
 *
 * The same six values the player's stream sheet names, in the same voice, so the
 * operator reading "from the server" here and "HTTP" on the phone is reading one
 * fact rather than two. `direct` is the one that earns its own line: it is the
 * rescue path, and it is the only one of the six that is a fault.
 *
 * An unknown value prints itself. A newer client can report a state this build
 * has no word for, and borrowing another state's name would file a new failure
 * under an old label.
 */
const KEYS: Record<string, MessageKey> = {
  connected: 'usage.torrent',
  waiting: 'usage.sourceWaiting',
  webseed: 'usage.webseed',
  mixed: 'usage.sourceMixed',
  direct: 'usage.sourceDirect',
  // Legacy: one word for connected-and-waiting, which is what the pair meant. It
  // keeps the filter's own name ("Legacy: peers or server") rather than "Peers":
  // a window can hold both states at once, and two rows called Peers reads as a
  // duplicate, not as two populations.
  torrent: 'usage.legacyPair',
};

export function sourceLabel(source: string, t: (key: MessageKey) => string): string {
  const key = KEYS[source];
  return key ? t(key) : source;
}
