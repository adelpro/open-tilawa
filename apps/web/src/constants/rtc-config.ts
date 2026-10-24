export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
    // Public IP (requires DNS A record + firewall + DDNS for dynamic IP)
    {
      urls: 'turn:turn.quran.us.kg:3478?transport=udp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || '341262c7dc0f019ca3532b9f',
    },
    {
      urls: 'turn:turn.quran.us.kg:3478?transport=tcp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || '341262c7dc0f019ca3532b9f',
    },
    // Tailscale IP (stable, works for Tailscale-connected clients only)
    {
      urls: 'turn:100.126.101.73:3478?transport=udp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || '341262c7dc0f019ca3532b9f',
    },
    {
      urls: 'turn:100.126.101.73:3478?transport=tcp',
      username: (import.meta as any).env?.VITE_TURN_USERNAME || 'openquran',
      credential: (import.meta as any).env?.VITE_TURN_PASSWORD || '341262c7dc0f019ca3532b9f',
    },
  ],
};
