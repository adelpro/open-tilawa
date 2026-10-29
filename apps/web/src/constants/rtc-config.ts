/**
 * ICE servers for the peer connection.
 *
 * The TURN credential is injected at build time. It used to be a hardcoded
 * fallback, which shipped a working relay password to every visitor: the string
 * was in `dist/assets/index-*.js` four times. `apps/web/Dockerfile` now passes
 * VITE_TURN_USERNAME and VITE_TURN_PASSWORD as build args, and the compose file
 * reads them from the same .env coturn reads.
 *
 * With no build args the relay is simply not offered. That is the right
 * failure — STUN and DHT still connect most peers, whereas a static credential
 * in a public bundle lets anyone relay their traffic through this server.
 *
 * The two Tailscale endpoints that used to be listed here are gone on purpose.
 * `turn:100.126.101.73` only resolves inside one private tailnet, so for every
 * real listener it was a dead candidate — and it published the tailnet's
 * address in the bundle.
 */
const env = (import.meta as { env?: Record<string, string> }).env;
const username = env?.VITE_TURN_USERNAME;
const credential = env?.VITE_TURN_PASSWORD;

/** One entry per transport, or nothing at all when no credential was built in. */
function turn(transport: 'udp' | 'tcp'): RTCIceServer[] {
  if (!username || !credential) return [];
  return [
    {
      urls: `turn:turn.tilawah.cc:3478?transport=${transport}`,
      username,
      credential,
    },
  ];
}

export const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    ...turn('udp'),
    ...turn('tcp'),
  ],
};
