export const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
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
