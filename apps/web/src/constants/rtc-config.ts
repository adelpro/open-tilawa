export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Tailscale IP (stable, no dynamic IP issue) - works for Tailscale-connected clients
    {
      urls: 'turn:100.126.101.73:3478?transport=udp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || 'change-me-in-prod',
    },
    {
      urls: 'turn:100.126.101.73:3478?transport=tcp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || 'change-me-in-prod',
    },
    // Public hostname (requires DNS A record + firewall) - works for non-Tailscale clients
    {
      urls: 'turn:turn.quran.us.kg:3478?transport=udp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || 'change-me-in-prod',
    },
    {
      urls: 'turn:turn.quran.us.kg:3478?transport=tcp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || 'change-me-in-prod',
    },
  ],
};
