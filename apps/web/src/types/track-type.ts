export type TrackType = {
  surahId: number;
  link: string;
  file?: any;
  // All web-seed base URLs discovered from the magnet's ws= params (auto-discovered).
  webSeeds?: string[];
  error?: string;
};
