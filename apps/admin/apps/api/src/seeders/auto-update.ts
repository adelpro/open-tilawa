/**
 * When the console may update a node without being asked.
 *
 * Kept out of the service so the rule can be read and tested on its own: this is
 * the one path where the console changes a machine while nobody is looking. The
 * default is off, the node must already accept updates, and a failed attempt must
 * wait before it is tried again — otherwise a node that cannot pull would be
 * rebuilt every five minutes, which is a denial of service with good intentions.
 */

/** How long a node is left alone after an attempt, successful or not. */
export const AUTO_UPDATE_RETRY_MS = 30 * 60_000;

export type AutoUpdateInput = {
  /** The operator's switch for this node. Off unless they turned it on. */
  autoUpdate: boolean;
  /** Pinned (this host) or a node that offered `selfUpdate`. */
  capable: boolean;
  status: 'online' | 'offline' | 'unknown' | string;
  version: string | null;
  desiredVersion: string | null;
  /** A job is already running; two recreates must never overlap. */
  updating: boolean;
  /** `last_update_at`: when the last attempt started (or finished). */
  lastAttemptAt: string | null;
  now: number;
};

export function shouldAutoUpdate(input: AutoUpdateInput, retryAfterMs = AUTO_UPDATE_RETRY_MS): boolean {
  if (!input.autoUpdate || !input.capable) return false;
  // Silence is not evidence that a node is ready to be restarted.
  if (input.status !== 'online' || input.updating) return false;
  if (!input.version || !input.desiredVersion) return false;
  if (input.version === input.desiredVersion) return false;
  // A clock that cannot be read is not permission to act.
  if (input.lastAttemptAt) {
    const last = Date.parse(input.lastAttemptAt);
    if (!Number.isFinite(last)) return false;
    if (input.now - last < retryAfterMs) return false;
  }
  return true;
}
