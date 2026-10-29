/**
 * Arabic names for the catalogue, keyed by infohash.
 *
 * The seeder names a torrent after the folder it found on disk
 * (`Maher_Al-Muaiqly_(Update2)_(MP3_Quran)`). That is a file name, not a name,
 * and it is not Arabic. The infohash is the only stable join: a reciter can be
 * re-torrented, and two reciters can share a name.
 *
 * Seeding is idempotent and only fills rows whose `name_ar` is still null, so an
 * operator's edit in the console is never overwritten.
 */
export const RECITER_NAMES_AR: Record<string, string> = {
  '012101c66ee42d7c5905ab910e2b129335f4f30d': 'ياسين الجزائري (ورش)',
  '110eedff1111d5028bfb853dd13ca903cffd4d10': 'عبد الباسط عبد الصمد (ورش)',
  '1a65ddf6472839c8ec02248650330cac38109670': 'محمود خليل الحصري',
  '1b3246af9ed31b4ecd21f5e66b805deff875c401': 'محمد صديق المنشاوي',
  '2ea34e7b6c81ac42740c41ad98675cd30db99132': 'مفتاح السلطني (قالون)',
  '331e7486de1a8c634f4e1e5c78906e015187a76d': 'عبد الباسط عبد الصمد (مجوّد)',
  '465aa4a5cc2dafe86cd616f1dc9e94b1dce36496': 'ماهر المعيقلي (تحديث)',
  '47db7a2155fef5797c046105aaa6eb16be47a7ed': 'أبو بكر الشاطري',
  '4d8cbf2a1b53bd2d18a8fa155684da30518cd99e': 'فارس عباد',
  '4dd0536b0d17d0f463ea221a211384d185511bec': 'محمود خليل الحصري',
  '5e0becf35d91ea4602f04db90d74621a172aa396': 'ماهر المعيقلي',
  '5ff661fbeab765b85d90d6e4782c47d20eae33cf': 'عبد الله بصفر',
  '65495a38fa9b277fc7fde00d5df94ddd4f0b332b': 'خالد الجليل',
  '6933143973516e771c4f2c756e095176bebc7c58': 'وديع اليمني',
  '823ce8332e2bd3d555b5c35fc12bab50a6976481': 'مشاري راشد العفاسي',
  '87c83e0b4432d70565e2dbc4e20988285778e189': 'محمود خليل الحصري (ورش)',
  '8f7d9f4dcdde90177b90c8ee362fe90cee58da56': 'صابر عبد الحكم (ورش)',
  '98e5196da5665c10eab1f7d951cd1fc840cd73b6': 'هزاع البلوشي',
  'bb7093b290ac61d10b5a6357087cd670bb6ba931': 'محمد الكنتاوي (ورش)',
  'c4ac5dece90004fb389a2fc378847dab54d9f1d3': 'محمود خليل الحصري (قالون)',
  'eb11251ff351a202a72f2959fae7e3a4183a6fb9': 'عبد الرحمن السديس',
  'f34936b46c18b3ff2a7eb42d1f2c30d4b8f02b03': 'أحمد العجمي',
  'f5fb5572e70163e72b1fb6add43da32da60dd97f': 'ياسر الدوسري',
  'f6bd1e59ec0ed88d2c14e5548efc54cf0d5d8ba8': 'صابر عبد الحكم (الدوري)',
  'f956a7017cf67fe1d2b4738195444137044e6970': 'مفتاح السلطني (ورش)',
  'fbf3bfbfbc5baad0d9d2395fb0f20294723b9930': 'محمد صديق المنشاوي',
  'ff77deab793113dabf0a39d85fe6dbfdb107438a': 'سعد الغامدي',
};
