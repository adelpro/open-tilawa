/**
 * The riwaya each catalogue row actually recites, keyed by infohash.
 *
 * The seeder imports a torrent and knows nothing about the reading, so every row
 * arrived as "Hafs" — including the Warsh and Qalun releases, whose riwaya was
 * only visible in the folder name. Filters built on that column were useless.
 * Unknown hashes keep whatever the row already says.
 */
export const RECITER_RIWAYA: Record<string, string> = {
  '012101c66ee42d7c5905ab910e2b129335f4f30d': 'Warsh',
  '110eedff1111d5028bfb853dd13ca903cffd4d10': 'Warsh',
  '331e7486de1a8c634f4e1e5c78906e015187a76d': 'Hafs',
  '465aa4a5cc2dafe86cd616f1dc9e94b1dce36496': 'Hafs',
  '47db7a2155fef5797c046105aaa6eb16be47a7ed': 'Hafs',
  '4d8cbf2a1b53bd2d18a8fa155684da30518cd99e': 'Hafs',
  '4dd0536b0d17d0f463ea221a211384d185511bec': 'Hafs',
  '5e0becf35d91ea4602f04db90d74621a172aa396': 'Hafs',
  '65495a38fa9b277fc7fde00d5df94ddd4f0b332b': 'Hafs',
  '6933143973516e771c4f2c756e095176bebc7c58': 'Hafs',
  '823ce8332e2bd3d555b5c35fc12bab50a6976481': 'Hafs',
  '87c83e0b4432d70565e2dbc4e20988285778e189': 'Warsh',
  '98e5196da5665c10eab1f7d951cd1fc840cd73b6': 'Hafs',
  'bb7093b290ac61d10b5a6357087cd670bb6ba931': 'Warsh',
  'c4ac5dece90004fb389a2fc378847dab54d9f1d3': 'Qalon',
  'eb11251ff351a202a72f2959fae7e3a4183a6fb9': 'Hafs',
  'f34936b46c18b3ff2a7eb42d1f2c30d4b8f02b03': 'Hafs',
  'f5fb5572e70163e72b1fb6add43da32da60dd97f': 'Hafs',
  'fbf3bfbfbc5baad0d9d2395fb0f20294723b9930': 'Hafs',
  'ff77deab793113dabf0a39d85fe6dbfdb107438a': 'Hafs',
};
