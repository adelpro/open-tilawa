export const clientConfig = {
  APP_NAME: (import.meta as any).env?.VITE_APP_NAME || 'Open Quran',
  APP_URL: (import.meta as any).env?.VITE_APP_URL || 'https://tilawa.quran.us.kg',
  TRACKER_ONE_URL:
    (import.meta as any).env?.VITE_TRACKER_ONE_URL || 'wss://trackerf.quran.us.kg',
  TRACKER_TWO_URL:
    (import.meta as any).env?.VITE_TRACKER_TWO_URL || '',

  DEBUG: (import.meta as any).env?.VITE_DEBUG || false,
};

export const serverConfig = {};
