/**
 * Copy for the two locales. Arabic is the source: every key exists in `ar` and
 * `en` is typed against it, so a missing translation is a compile error rather
 * than a blank row.
 */
export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

const ar = {
  brand: 'تلاوة',
  menu: { open: 'القائمة', close: 'إغلاق القائمة' },
  common: { close: 'إغلاق' },
  routes: { listen: 'الاستماع', settings: 'الإعدادات', about: 'عن تلاوة', privacy: 'الخصوصية' },
  settings: {
    language: 'اللغة',
    appearance: 'المظهر',
    light: 'فاتح',
    dark: 'داكن',
    speed: 'السرعة',
    shape: 'شكل الطيف',
    sleep: 'مؤقّت النوم',
    off: 'إيقاف',
    pageTitle: 'الإعدادات',
    appearanceHint: 'فاتح أو داكن — يُحفظ مع بقية اختياراتك.',
    languageHint: 'لغة الواجهة واتجاه الصفحة.',
    playbackHint: 'سرعة التلاوة ومؤقّت يوقف التشغيل وحده.',
    shapeHint: 'شكل الطيف فوق شريط التقدّم.',
    minutes: (count: number) => `${count} د`,
  },
  shapes: { bars: 'أعمدة', peaks: 'قِمم', ribbon: 'شريط' } as Record<string, string>,
  footer: {
    list: 'قائمة السور',
    reciter: 'اختيار القارئ',
    mute: 'كتم الصوت',
    unmute: 'إلغاء كتم الصوت',
    speedChange: (rate: string) => `السرعة ${rate}، تغيير السرعة`,
  },
  source: {
    connected: 'متصل عبر الأقران',
    waiting: 'بانتظار الأقران',
    http: 'يعمل من خادم القارئ',
    p2p: 'P2P',
    label: 'HTTP',
    fromPeers: 'من الشبكة الندّية',
    fromHost: 'من خادم القارئ',
  },
  stream: {
    title: 'تفاصيل البث',
    peers: 'الأقران',
    down: 'التنزيل',
    up: 'الرفع',
    downloaded: 'المُنزَّل',
    progress: 'التقدّم',
    files: 'الملفات',
    httpNote: 'يُشغَّل من خادم القارئ مباشرة، فلا يحتاج إلى أقران.',
    waitingNote: 'لم يتصل أي قارئ بعد. التشغيل يبدأ عندما يظهر أوّل قرين.',
  },
  sheets: {
    surahs: 'السور',
    reciters: 'القرّاء',
    searchSurahs: 'ابحث باسم السورة أو رقمها',
    searchReciters: 'ابحث باسم القارئ',
    labelSurahs: 'بحث في السور',
    labelReciters: 'بحث في القرّاء',
    clear: 'مسح البحث',
    empty: 'لا نتائج',
    complete: 'كامل',
    partial: 'جزئي',
    all: 'الكل',
    http: 'HTTP',
    juz: (n: number) => `الجزء ${n}`,
    verses: (n: number) =>
      n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? `${n} آيات` : `${n} آية`,
    riwaya: { hafs: 'حفص', warsh: 'ورش', qalon: 'قالون' } as Record<string, string>,
  },
  transport: {
    previous: 'السورة السابقة',
    back: 'ارجع 15 ثانية',
    play: 'تشغيل',
    pause: 'إيقاف مؤقت',
    forward: 'تقدم 15 ثانية',
    next: 'السورة التالية',
  },
  scrubber: { label: 'موضع التشغيل', of: 'من' },
  player: { error: 'تعذّر تشغيل هذا القارئ.', retry: 'إعادة المحاولة', surah: (n: number) => `سورة ${n}` },
  about: {
    title: 'عن تلاوة',
    body1:
      'تلاوة تطبيق لسماع القرآن الكريم، يبثّ التلاوات عبر الشبكة الندّية بدل خوادم مركزية، ويعمل من المتصفح دون حساب.',
    body2:
      'المصحف مرتّب على ترتيب المصحف، ولكل قارئ ملف واحد لكل سورة. عند تعطّل الشبكة الندّية يعود التطبيق إلى روابط MP3 المباشرة حين تتوفّر.',
    source: 'الكود المصدري',
    license: 'الخطوط: IBM Plex Sans Arabic، رخصة SIL OFL 1.1. الإصدار',
  },
  privacy: {
    title: 'الخصوصية',
    items: [
      'لا حساب، ولا تسجيل، ولا بريد إلكتروني.',
      'لا تحليلات ولا تتبّع إعلاني ولا بكسلات قياس.',
      'موضع الاستماع والقارئ المختار يُخزَّنان في متصفحك وحده (localStorage)، ويُحذفان بمسح بيانات الموقع.',
      'الاتصالات الخارجة ثلاثة فقط: كتالوج القرّاء، وشبكة التورنت (الأقران ومواقع الويب)، وروابط MP3 عند اختيار قارئ بلا ملف تورنت.',
      'لا نبيع شيئاً ولا نرسل بياناتك إلى أي طرف ثالث.',
    ],
  },
};

const en: typeof ar = {
  brand: 'Tilawa',
  menu: { open: 'Menu', close: 'Close menu' },
  common: { close: 'Close' },
  routes: { listen: 'Listen', settings: 'Settings', about: 'About Tilawa', privacy: 'Privacy' },
  settings: {
    language: 'Language',
    appearance: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    speed: 'Speed',
    shape: 'Spectrum',
    sleep: 'Sleep timer',
    off: 'Off',
    pageTitle: 'Settings',
    appearanceHint: 'Light or dark — saved with the rest of your choices.',
    languageHint: 'Interface language and page direction.',
    playbackHint: 'Recitation speed, and a timer that stops playback on its own.',
    shapeHint: 'The shape of the spectrum above the scrubber.',
    minutes: (count: number) => `${count} min`,
  },
  shapes: { bars: 'Bars', peaks: 'Peaks', ribbon: 'Ribbon' },
  footer: {
    list: 'Surah list',
    reciter: 'Choose reciter',
    mute: 'Mute',
    unmute: 'Unmute',
    speedChange: (rate: string) => `Speed ${rate}, change speed`,
  },
  source: {
    connected: 'Connected to peers',
    waiting: 'Waiting for peers',
    http: 'Playing from the reciter host',
    p2p: 'P2P',
    label: 'HTTP',
    fromPeers: 'from the peer network',
    fromHost: 'from the reciter host',
  },
  stream: {
    title: 'Stream details',
    peers: 'Peers',
    down: 'Download',
    up: 'Upload',
    downloaded: 'Downloaded',
    progress: 'Progress',
    files: 'Files',
    httpNote: 'Plays straight from the reciter host, so it needs no peers.',
    waitingNote: 'No peer has connected yet. Playback starts with the first one.',
  },
  sheets: {
    surahs: 'Surahs',
    reciters: 'Reciters',
    searchSurahs: 'Search by name or number',
    searchReciters: 'Search by reciter',
    labelSurahs: 'Search surahs',
    labelReciters: 'Search reciters',
    clear: 'Clear search',
    empty: 'No results',
    complete: 'Complete',
    partial: 'Partial',
    all: 'All',
    http: 'HTTP',
    juz: (n: number) => `Juz ${n}`,
    verses: (n: number) => (n === 1 ? '1 verse' : `${n} verses`),
    riwaya: { hafs: 'Hafs', warsh: 'Warsh', qalon: 'Qalon' },
  },
  transport: {
    previous: 'Previous surah',
    back: 'Back 15 seconds',
    play: 'Play',
    pause: 'Pause',
    forward: 'Forward 15 seconds',
    next: 'Next surah',
  },
  scrubber: { label: 'Playback position', of: 'of' },
  player: { error: 'This reciter could not start.', retry: 'Try again', surah: (n: number) => `Surah ${n}` },
  about: {
    title: 'About Tilawa',
    body1:
      'Tilawa is a Quran listening app. It streams recitations over a peer-to-peer network instead of central servers, and runs in the browser without an account.',
    body2:
      'The surahs are in mushaf order, and each reciter is one file per surah. When the peer network is unavailable the app falls back to direct MP3 links where they exist.',
    source: 'Source code',
    license: 'Fonts: IBM Plex Sans Arabic, SIL OFL 1.1. Version',
  },
  privacy: {
    title: 'Privacy',
    items: [
      'No account, no sign-up, no email.',
      'No analytics, no ad tracking, no pixels.',
      'Your position and chosen reciter live in this browser only (localStorage), and go when you clear site data.',
      'Three outbound calls only: the reciter catalogue, the torrent network (peers and web seeds), and MP3 links when a reciter has no torrent.',
      'Nothing is sold, and nothing about you is sent to a third party.',
    ],
  },
};

export const MESSAGES: Record<Locale, typeof ar> = { ar, en };
export type Messages = typeof ar;

export function normaliseLocale(value: unknown): Locale {
  return value === 'en' ? 'en' : 'ar';
}

export const DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };
