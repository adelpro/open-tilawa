/**
 * Where the counters and account graphs live. One self-hosted relay, tunnelled
 * by cloudflared to the gun container on localhost:8765.
 *
 * `VITE_GUN_PEERS` overrides this (comma separated) — use it to point a preview
 * at a second relay instead of writing into the live one.
 */
const DEFAULT_PEERS = ['wss://gundb-relay.quran.us.kg/gun'];

export const getGunPeers = (): string[] => {
  const configured = (import.meta as { env?: Record<string, string> }).env?.VITE_GUN_PEERS;
  if (configured) {
    const peers = configured
      .split(',')
      .map((peer) => peer.trim())
      .filter(Boolean);
    if (peers.length > 0) return peers;
  }
  return DEFAULT_PEERS;
};
