/**
 * Arabic display names, keyed by infohash.
 *
 * The catalogue serves what is written on the torrent: `Maher_Al-Muaiqly_(Update2)_(MP3_Quran)`.
 * That is a file name, not a name, and it is not Arabic. Matching by infohash is
 * the only stable join — a reciter can be re-torrented, a name cannot be trusted.
 *
 * Two rules when adding a row:
 * - the hash is the identity, never the label;
 * - when one reciter has several torrents, say what distinguishes them
 *   (riwaya, updated files) instead of listing the same name twice.
 */
export const RECITER_NAMES_AR: Record<string, string> = {
  '012101c66ee42d7c5905ab910e2b129335f4f30d': 'ياسين الجزائري (ورش)',
  '110eedff1111d5028bfb853dd13ca903cffd4d10': 'عبد الباسط عبد الصمد (ورش)',
  '331e7486de1a8c634f4e1e5c78906e015187a76d': 'عبد الباسط عبد الصمد (مجوّد)',
  '465aa4a5cc2dafe86cd616f1dc9e94b1dce36496': 'ماهر المعيقلي (تحديث)',
  '47db7a2155fef5797c046105aaa6eb16be47a7ed': 'أبو بكر الشاطري',
  '4d8cbf2a1b53bd2d18a8fa155684da30518cd99e': 'فارس عباد',
  '4dd0536b0d17d0f463ea221a211384d185511bec': 'محمود خليل الحصري',
  '5e0becf35d91ea4602f04db90d74621a172aa396': 'ماهر المعيقلي',
  '65495a38fa9b277fc7fde00d5df94ddd4f0b332b': 'خالد الجليل',
  '6933143973516e771c4f2c756e095176bebc7c58': 'وديع اليمني',
  '823ce8332e2bd3d555b5c35fc12bab50a6976481': 'مشاري راشد العفاسي',
  '87c83e0b4432d70565e2dbc4e20988285778e189': 'محمود خليل الحصري (ورش)',
  '98e5196da5665c10eab1f7d951cd1fc840cd73b6': 'هزاع البلوشي',
  'bb7093b290ac61d10b5a6357087cd670bb6ba931': 'محمد الكنتاوي (ورش)',
  'c4ac5dece90004fb389a2fc378847dab54d9f1d3': 'محمود خليل الحصري (قالون)',
  'eb11251ff351a202a72f2959fae7e3a4183a6fb9': 'عبد الرحمن السديس',
  'f34936b46c18b3ff2a7eb42d1f2c30d4b8f02b03': 'أحمد العجمي',
  'f5fb5572e70163e72b1fb6add43da32da60dd97f': 'ياسر الدوسري',
  'fbf3bfbfbc5baad0d9d2395fb0f20294723b9930': 'محمد صديق المنشاوي',
  'ff77deab793113dabf0a39d85fe6dbfdb107438a': 'سعد الغامدي',
};
