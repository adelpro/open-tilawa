const getEnv = () => {
  const env = (import.meta as any).env?.VITE_APP_ENV || (import.meta as any).env?.MODE || 'dev';
  return String(env);
};

export const getGunKeys = () => {
  const env = getEnv();
  return {
    viewCounts: `open-tilawa-${env}-view-counts`,
    favoriteCounts: `open-tilawa-${env}-favorite-counts`,
  };
};
