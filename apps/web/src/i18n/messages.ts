/**
 * Copy for the two locales. Arabic is the source: every key exists in `ar` and
 * `en` is typed against it, so a missing translation is a compile error rather
 * than a blank row.
 */
export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

import type { RelativeUnit } from '@/utils/relative-time';

/**
 * Arabic counts agree with the noun by number: 3–10 take the plural (أشهر),
 * 11–99 the singular accusative (شهرًا), and 100+ the plain singular (شهر).
 * One and two are their own words, so the preposition travels with them.
 */
function arabicAgo(
  n: number,
  forms: { one: string; two: string; few: string; many: string; plain: string },
): string {
  if (n === 1) return forms.one;
  if (n === 2) return forms.two;
  if (n <= 10) return `قبل ${n} ${forms.few}`;
  if (n < 100) return `قبل ${n} ${forms.many}`;
  return `قبل ${n} ${forms.plain}`;
}

const ar = {
  brand: 'تلاوة',
  menu: { open: 'القائمة', close: 'إغلاق القائمة', more: 'المزيد' },
  common: {
    close: 'إغلاق',
    pin: 'تثبيت اللوحة',
    unpin: 'إلغاء التثبيت',
  },
  keys: {
    title: 'الاختصارات',
    playPause: 'تشغيل / إيقاف',
    seek: 'تقديم أو إرجاع 15 ثانية',
    surahs: 'السورة السابقة / التالية',
    reciters: 'قائمة القرّاء',
    surahList: 'قائمة السور',
    mute: 'كتم الصوت',
    help: 'هذه القائمة',
    close: 'إغلاق اللوحة',
    hint: 'Space للتشغيل · ←/→ 15 ثانية · ؟ للمزيد',
    dismiss: 'إخفاء',
  },
  routes: {
    listen: 'الاستماع',
    settings: 'الإعدادات',
    about: 'عن تلاوة',
    privacy: 'الخصوصية',
    reciters: 'القرّاء',
  },
  notFound: {
    title: 'هذه الصفحة غير موجودة',
    body: 'الرابط الذي فتحته لا يؤدي إلى صفحة في تلاوة.',
    home: 'العودة إلى الاستماع',
  },
  recitersPage: {
    title: 'القرّاء',
    lede: 'هؤلاء هم القرّاء المنشورون في تلاوة، ولكل واحد منهم تلاوة كاملة. اختر قارئًا، ثم اختر السورة التي تريد سماعها.',
  },
  surahPage: {
    title: (name: string) => `سورة ${name}`,
    lede: (name: string) => `استمع إلى سورة ${name} بصوت كل قارئ منشور في تلاوة.`,
    previous: 'السورة السابقة',
    next: 'السورة التالية',
  },
  account: {
    title: 'الحساب',
    ringOf: 'حلقتك:',
    deviceCount: (n: number) =>
      n === 1 ? 'جهاز واحد' : n === 2 ? 'جهازان' : `${n} أجهزة`,
    devices: 'الأجهزة',
    addDevice: 'إضافة جهاز',
    createTitle: 'حلقة جديدة',
    createAction: 'إنشاء حلقة',
    ringName: 'اسم الحلقة',
    rename: 'تسمية الحلقة',
    renameSave: 'حفظ',
    renameCancel: 'إلغاء',
    createNote:
      'الحلقة مفتاح يُولَّد هنا ويُحفظ في هذا المتصفح — لا اسم مستخدم ولا كلمة مرور. أضف جهازاً آخر إليها الآن إن أردت أن تبقى الحلقة ومفضّلاتها بعد فقد هذا الجهاز.',
    joinTitle: 'الانضمام إلى حلقة',
    joinNote: 'امسح رمزاً من جهاز داخل الحلقة، فينسخ جهازك المفتاح نفسه.',
    manualToggle: 'إدخال الرمز يدوياً',
    manualNote: 'للأجهزة بلا كاميرا: انسخ الرمز من الجهاز الآخر وألصقه هنا.',
    manualPlaceholder: '{ ... }',
    manualAction: 'ربط',
    manualInvalid: 'الرمز غير صالح أو انتهت مدته',
    shareTitle: 'إضافة جهاز إلى الحلقة',
    shareNote:
      'الرمز يحمل مفتاحاً لمرة واحدة، لا مفتاح الحلقة. ينتهي خلال دقيقتين ويُحرق بعد أول مسح ناجح.',
    showCode: 'إظهار رمز الربط',
    newCode: 'توليد رمز جديد',
    copyCode: 'نسخ الرمز',
    copied: 'تم النسخ',
    copyFailed: 'تعذّر النسخ',
    expiresIn: (s: number) => `ينتهي خلال ${s} ثانية`,
    scanTitle: 'مسح رمز',
    scanHint: 'وجّه الكاميرا إلى رمز الربط',
    scanStart: 'المسح بالكاميرا',
    scanStop: 'إيقاف الكاميرا',
    linkedHere: 'تم ربط هذا الجهاز بالحلقة',
    linkedOther: (name?: string) =>
      name ? `أُضيف «${name}» إلى الحلقة` : 'أُضيف جهاز جديد إلى الحلقة',
    linkedHint: 'تظهر أجهزة الحلقة أدناه، وتتزامن المفضّلة والإعدادات تلقائياً.',
    scanJoining: 'جارٍ ربط هذا الجهاز…',
    scanAgain: 'إعادة المسح',
    codeTimeout: 'لم يصل رمز الربط. تحقّق من الشبكة ثم أعد المحاولة.',
    cameraUnavailable: 'الكاميرا غير متاحة',
    cameraBlockedTitle: 'المتصفح يمنع الكاميرا',
    cameraBlockedNote: 'اسمح بالكاميرا لهذا الموقع من إعدادات المتصفح، ثم أعد المحاولة.',
    cameraNoDeviceTitle: 'هذا الجهاز بلا كاميرا',
    cameraNoDeviceNote: 'انسخ الرمز من الجهاز الآخر وألصقه هنا؛ النتيجة نفسها.',
    cameraBusyTitle: 'الكاميرا قيد الاستخدام',
    cameraBusyNote: 'يستخدمها تطبيق آخر. أغلقه ثم أعد المحاولة، أو ألصق الرمز يدوياً.',
    cameraSecureTitle: 'المسح يحتاج اتصالاً آمناً',
    cameraSecureNote: 'الكاميرا لا تعمل إلا عبر https أو localhost. ألصق الرمز يدوياً بدلاً منها.',
    cameraRetry: 'إعادة المحاولة',
    scanOpening: 'جارٍ فتح الكاميرا…',
    scanBack: 'رجوع',
    codeFailed: 'تعذّر إنشاء رمز الربط',
    devicesNote:
      'كل جهاز في هذه الحلقة يحمل المفتاح نفسه. الإخراج يُسجّل خروج ذلك الجهاز محلياً فقط، ولا يُلغي المفتاح.',
    noDevices: 'لا أجهزة مسجّلة بعد.',
    thisDevice: 'هذا الجهاز',
    primary: 'الأساسي',
    lastSeen: (when: string) => `آخر ظهور ${when}`,
    added: (when: string) => `أُضيف ${when}`,
    ago: (unit: RelativeUnit, n: number): string => {
      switch (unit) {
        case 'now':
          return 'الآن';
        case 'minute':
          return arabicAgo(n, { one: 'قبل دقيقة', two: 'قبل دقيقتين', few: 'دقائق', many: 'دقيقة', plain: 'دقيقة' });
        case 'hour':
          return arabicAgo(n, { one: 'قبل ساعة', two: 'قبل ساعتين', few: 'ساعات', many: 'ساعة', plain: 'ساعة' });
        case 'day':
          return arabicAgo(n, { one: 'قبل يوم', two: 'قبل يومين', few: 'أيام', many: 'يومًا', plain: 'يوم' });
        case 'week':
          return arabicAgo(n, { one: 'قبل أسبوع', two: 'قبل أسبوعين', few: 'أسابيع', many: 'أسبوعًا', plain: 'أسبوع' });
        case 'month':
          return arabicAgo(n, { one: 'قبل شهر', two: 'قبل شهرين', few: 'أشهر', many: 'شهرًا', plain: 'شهر' });
        case 'year':
          return arabicAgo(n, { one: 'قبل سنة', two: 'قبل سنتين', few: 'سنوات', many: 'سنة', plain: 'سنة' });
      }
    },
    signOutTitle: 'تسجيل الخروج',
    signOutSafe: 'أجهزتك الأخرى تبقى مسجّلة. هذا المتصفح ينسى المفتاح ويحتاج رمز ربط جديداً.',
    signOutLast:
      'هذا هو الجهاز الوحيد في الحلقة. تسجيل الخروج هنا يمحو المفتاح من هذا المتصفح، ولا توجد كلمة مرور تستعيده — تصبح الحلقة وكل مفضّلة فيها غير قابلة للاستعادة. أضف جهازاً آخر أولاً، أو أبقِ هذا الجهاز.',
    signOutConfirm: 'اكتب «تسجيل الخروج» للتأكيد',
    signOutConfirmWord: 'تسجيل الخروج',
    signOutAction: 'تسجيل الخروج من هذا الجهاز',
  },
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
    connected: 'P2P',
    waiting: 'بانتظار الأقران',
    webseed: 'HTTP',
    mixed: 'P2P + HTTP',
  },
  stream: {
    title: 'تفاصيل البث',
    peers: 'الأقران',
    down: 'التنزيل',
    up: 'الرفع',
    downloaded: 'المُنزَّل',
    progress: 'التقدّم',
    files: 'الملفات',
    source: 'المصدر',
    fallback: 'البديل',
    fallbackAvailable: 'متوفّر',
    fallbackMissing: 'غير متوفّر',
    fallbackChecking: 'جارٍ الفحص',
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
    recitersError: 'تعذّر تحميل القرّاء. تحقّق من اتصالك ثم أعد المحاولة.',
    sortDefault: 'أبجدي',
    myFavorites: 'مفضّلتي',
    myRecent: 'آخر ما استمعت',
    sortFavorites: 'الأكثر تفضيلاً',
    sortViews: 'الأكثر استماعاً',
    favorites: 'المفضّلة',
    views: 'الاستماعات',
    addFavorite: 'أضف إلى المفضّلة',
    removeFavorite: 'أزل من المفضّلة',
    juz: (n: number) => `الجزء ${n}`,
    verses: (n: number) =>
      n === 1 ? 'آية واحدة' : n === 2 ? 'آيتان' : n <= 10 ? `${n} آيات` : `${n} آية`,
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
  player: {
    error: 'تعذّر تشغيل هذا القارئ.',
    noReciters: 'لا يوجد قرّاء منشورون بعد.',
    retry: 'إعادة المحاولة',
    surah: (n: number) => `سورة ${n}`,
  },
  about: {
    title: 'تلاوة | القرآن أقرب إليك',
    lede: 'تلاوة مشغّل قرآن مجاني، بلا إعلانات ولا اشتراكات ولا حساب تسجيل. اختر قارئك وسورتك، ثم استمع.',
    how: {
      title: 'كيف يعمل تلاوة؟',
      p1: 'لا يعتمد تلاوة في توصيل الصوت على خادم واحد، بل يتبادل أجزاء التسجيل بين المستمعين عبر WebTorrent: يستقبل جهازك الصوت من أجهزة تستمع إلى التسجيل نفسه، ويستطيع أن يرسل إليها ما استقبله.',
      p2: 'ولا تنتظر اكتمال التنزيل: يبدأ التشغيل مع وصول الأجزاء الأولى، ويمكنك التقديم والتأخير في أثناء ذلك.',
    },
    noPeers: {
      title: 'ماذا لو لم يكن هناك مستمعون آخرون؟',
      p1: 'إن لم يجد تلاوة أقراناً خلال 8 ثوانٍ، يبدأ بجلب أجزاء التسجيل من خادم المشروع، بحدّ أقصى مقداره 1 ميغابايت في الثانية للاتصال الواحد.',
      p2: 'ويبقى الاتصال بالخادم قائماً بعد العثور على أقران، حتى لا يتوقف التشغيل إذا تعذّر الحصول على الأجزاء من الأجهزة الأخرى؛ وهذا مهم خصوصاً على الهواتف، حيث يتغيّر الاتصال عند الانتقال بين الواي فاي وبيانات الهاتف.',
      p3: 'والأجزاء التي يستقبلها جهازك من الخادم يستطيع أن يرسلها إلى مستمعين آخرين، وقد يصبح جهازك نفسه مصدراً للصوت لغيرك.',
    },
    ring: {
      title: 'مزامنة أجهزتك',
      p1: 'لا تحتاج إلى حساب للاستماع إلى القرآن. وإن أردت مزامنة مفضّلتك وإعداداتك بين جهازين، أنشئ حلقة وانقل مفتاحها برمز QR.',
      p2: 'يُنشأ المفتاح على جهازك، ولا يحتفظ به أي خادم ولا توجد منه نسخة سحابية. ويبقى على الأجهزة التي تشترك في الحلقة نفسها؛ فإن ضاع من جميعها، ضاعت البيانات معه، ولا سبيل إلى استرجاعها.',
    },
    know: {
      title: 'ما الذي ينبغي معرفته؟',
      items: [
        'تُزامَن الإعدادات والمفضلة والمشاهدات بين أجهزة الحلقة.',
        'إذا فقدت جميع الأجهزة التي تحتفظ بالمفتاح، لم تستطع استعادة الحلقة.',
        'يُحفظ موضع توقفك في السورة في هذا المتصفح وحده، ولا يُزامَن بين الأجهزة.',
      ],
    },
    sources: {
      title: 'التسجيلات والروايات',
      p1: 'تأتي التسجيلات في تطبيق تلاوة من كتالوج مجتمع إتقان (itqan.dev)، عبر منصّة «فنار» لنشر المحتوى القرآني؛ والحقوق تعود إلى أصحابها من القرّاء والناشرين.',
      p2: 'وتظهر الرواية، مثل حفص أو ورش أو قالون، بجانب اسم القارئ متى عُرفت؛ وإن لم تُعرف، لا نفترض رواية بعينها.',
    },
    open: {
      title: 'مشروع مفتوح المصدر',
      p1: 'تطبيق تلاوة مشروع مفتوح المصدر: يمكنك الاطلاع على الشيفرة والمساهمة في تطويرها.',
      source: 'الشيفرة المصدرية:',
      report: 'للإبلاغ عن تسجيل لا يعمل أو قارئ ناقص:',
    },
    closing:
      'يجعل تلاوة الاستماع إلى القرآن بسيطاً، ويتيح للمستمعين أن يعين بعضهم بعضاً في إيصال الصوت، مستعيناً بخادم المشروع عند الحاجة.',
    license: 'الخطوط: IBM Plex Sans Arabic، رخصة SIL OFL 1.1. الإصدار',
  },
  privacy: {
    title: 'الخصوصية',
    items: [
      'الاستماع لا يتطلب منك حساباً: لا بريد ولا اسم ولا كلمة مرور.',
      'الحلقة اختيارية: إن ربطت أجهزتك بها، زامنت الإعدادات والمفضّلة، وحفظها خادم المزامنة ما دامت موصولة.',
      'لا إعلانات، ولا أدوات تتبّع.',
      'إحصاءات الاستخدام معطّلة حتى تشغّلها. وإن شغّلتها، عرفنا القارئ والسورة، ومن أين جاء الصوت، وهل تعطّل التشغيل؛ ولا نعرف من أنت، ولا نحتفظ بعنوان IP. ومرّة واحدة في اليوم على الأكثر، يصلنا أنّ جهازاً فتح التطبيق، بلا معرّف يربط الأيام بعضها ببعض.',
      'موضع توقّفك في كل سورة محفوظ في هذا المتصفح وحده: لا يصل إلى الحلقة، ولا ينتقل إلى أجهزتك الأخرى، ولكل جهاز موضعه. يبقى حتى تمسح بيانات الموقع، فإذا مسحتها ذهب معها.',
      'أثناء الاستماع لا يتصل جهازك إلا بثلاثة: كتالوج القرّاء، وشبكة التورنت، وروابط MP3 إن لم يكن للقارئ ملف تورنت. والحلقة تضيف اتصالاً رابعاً بخادم المزامنة.',
      'لا نبيع شيئاً، ولا نرسل شيئاً عنك إلى طرف ثالث.',
    ],
  },
  telemetry: {
    title: 'إحصاءات الاستخدام',
    hint: 'لا تحمل اسمك، وتبقى معطّلة حتى تشغّلها.',
    details:
      'إن شغّلتها، وصلنا اسم القارئ والسورة ومصدر الصوت، وإن تعطّل التشغيل وصلنا الخبر. ومرّة واحدة في اليوم على الأكثر، وصلنا أنّ جهازاً فتح التطبيق، بلا معرّف. لا يصلنا اسمك، ولا نحتفظ بعنوان IP. ليس المقصود تتبّعك، بل معرفة ما ينكسر.',
    enabled: 'مفعّلة',
    disabled: 'معطّلة',
    nudge: 'هل تساعدنا بإحصاءات الاستخدام؟ لا تحمل اسمك، ولن نرسل شيئاً قبل موافقتك.',
    accept: 'تشغيل',
    later: 'ليس الآن',
    consent: 'أوافق على إرسال إحصاءات مجهولة الهوية',
  },
};

const en: typeof ar = {
  brand: 'Tilawah',
  menu: { open: 'Menu', close: 'Close menu', more: 'More' },
  common: {
    close: 'Close',
    pin: 'Pin this panel',
    unpin: 'Unpin this panel',
  },
  keys: {
    title: 'Keyboard',
    playPause: 'Play / pause',
    seek: 'Forward or back 15 seconds',
    surahs: 'Previous / next surah',
    reciters: 'Reciter list',
    surahList: 'Surah list',
    mute: 'Mute',
    help: 'This list',
    close: 'Close the panel',
    hint: 'Space to play · ←/→ 15 seconds · ? for more',
    dismiss: 'Dismiss',
  },
  routes: {
    listen: 'Listen',
    settings: 'Settings',
    about: 'About Tilawah',
    privacy: 'Privacy',
    reciters: 'Reciters',
  },
  notFound: {
    title: 'This page does not exist',
    body: 'The link you opened does not lead to a page in Tilawah.',
    home: 'Back to listening',
  },
  recitersPage: {
    title: 'Reciters',
    lede: 'These are the reciters published in Tilawah, each with a complete recitation. Pick a reciter, then the surah you want to hear.',
  },
  surahPage: {
    title: (name: string) => `Surah ${name}`,
    lede: (name: string) => `Listen to Surah ${name} in the voice of every reciter published in Tilawah.`,
    previous: 'Previous surah',
    next: 'Next surah',
  },
  account: {
    title: 'Account',
    ringOf: 'Your ring:',
    deviceCount: (n: number) => (n === 1 ? '1 device' : `${n} devices`),
    devices: 'Devices',
    addDevice: 'Add device',
    createTitle: 'New ring',
    createAction: 'Create ring',
    ringName: 'Ring name',
    rename: 'Rename the ring',
    renameSave: 'Save',
    renameCancel: 'Cancel',
    createNote:
      'A ring is a key generated here and kept in this browser — no username, no password. Add another device now if you want the ring and its favourites to outlive this one.',
    joinTitle: 'Join a ring',
    joinNote: 'Scan a code from a device already in the ring, and this device copies the key.',
    manualToggle: 'Enter the code by hand',
    manualNote: 'For devices without a camera: copy the code from the other device and paste it here.',
    manualPlaceholder: '{ ... }',
    manualAction: 'Link',
    manualInvalid: 'That code is not valid, or it has expired',
    shareTitle: 'Add a device to the ring',
    shareNote:
      'The code carries a one-time key, not the ring key. It expires in two minutes and is burned after the first successful scan.',
    showCode: 'Show pairing code',
    newCode: 'Generate a new code',
    copyCode: 'Copy the code',
    copied: 'Copied',
    copyFailed: 'Could not copy',
    expiresIn: (s: number) => `expires in ${s}s`,
    scanTitle: 'Scan a code',
    scanHint: 'Point the camera at the pairing code',
    scanStart: 'Scan with camera',
    scanStop: 'Stop camera',
    linkedHere: 'This device is now in the ring',
    linkedOther: (name?: string) =>
      name ? `“${name}” was added to the ring` : 'A new device was added to the ring',
    linkedHint: 'The ring’s devices are listed below, and favourites and settings now sync on their own.',
    scanJoining: 'Linking this device…',
    scanAgain: 'Scan again',
    codeTimeout: 'The pairing code did not arrive. Check your connection and try again.',
    cameraUnavailable: 'Camera unavailable',
    cameraBlockedTitle: 'The browser is blocking the camera',
    cameraBlockedNote: 'Allow the camera for this site in the browser settings, then try again.',
    cameraNoDeviceTitle: 'This device has no camera',
    cameraNoDeviceNote: 'Copy the code from the other device and paste it here; the result is the same.',
    cameraBusyTitle: 'The camera is in use',
    cameraBusyNote: 'Another app is using it. Close that app and try again, or paste the code instead.',
    cameraSecureTitle: 'Scanning needs a secure connection',
    cameraSecureNote: 'The camera only works over https or localhost. Paste the code instead.',
    cameraRetry: 'Try again',
    scanOpening: 'Opening the camera…',
    scanBack: 'Back',
    codeFailed: 'Could not create a pairing code',
    devicesNote:
      'Every device in this ring holds the same key. Signing one out only affects that device; it does not revoke the key.',
    noDevices: 'No devices recorded yet.',
    thisDevice: 'this device',
    primary: 'primary',
    lastSeen: (when: string) => `last seen ${when}`,
    added: (when: string) => `added ${when}`,
    ago: (unit: RelativeUnit, n: number): string => {
      switch (unit) {
        case 'now':
          return 'just now';
        case 'minute':
          return n === 1 ? '1 min ago' : `${n} min ago`;
        case 'hour':
          return n === 1 ? '1 hour ago' : `${n} hours ago`;
        case 'day':
          return n === 1 ? '1 day ago' : `${n} days ago`;
        case 'week':
          return n === 1 ? '1 week ago' : `${n} weeks ago`;
        case 'month':
          return n === 1 ? '1 month ago' : `${n} months ago`;
        case 'year':
          return n === 1 ? '1 year ago' : `${n} years ago`;
      }
    },
    signOutTitle: 'Sign out',
    signOutSafe:
      'Your other devices stay signed in. This browser forgets the key and will need a new pairing code.',
    signOutLast:
      'This is the only device in the ring. Signing out here erases the key from this browser, and there is no password to bring it back — the ring and every favourite in it become unrecoverable. Add another device first, or keep this one.',
    signOutConfirm: 'type "sign out" to confirm',
    signOutConfirmWord: 'sign out',
    signOutAction: 'Sign out on this device',
  },
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
    connected: 'P2P',
    waiting: 'Waiting for peers',
    webseed: 'HTTP',
    mixed: 'P2P + HTTP',
  },
  stream: {
    title: 'Stream details',
    peers: 'Peers',
    down: 'Download',
    up: 'Upload',
    downloaded: 'Downloaded',
    progress: 'Progress',
    files: 'Files',
    source: 'Source',
    fallback: 'Fallback',
    fallbackAvailable: 'Available',
    fallbackMissing: 'Unavailable',
    fallbackChecking: 'Checking',
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
    recitersError: 'Could not load the reciters. Check your connection and try again.',
    sortDefault: 'A–Z',
    myFavorites: 'My favourites',
    myRecent: 'Recently played',
    sortFavorites: 'Most favourited',
    sortViews: 'Most listened',
    favorites: 'favourites',
    views: 'listens',
    addFavorite: 'Add to favourites',
    removeFavorite: 'Remove from favourites',
    juz: (n: number) => `Juz ${n}`,
    verses: (n: number) => (n === 1 ? '1 verse' : `${n} verses`),
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
  player: {
    error: 'This reciter could not start.',
    noReciters: 'No reciter is published yet.',
    retry: 'Try again',
    surah: (n: number) => `Surah ${n}`,
  },
  about: {
    title: 'Tilawah | the Quran, closer',
    lede: 'Tilawah is a free Quran player — no adverts, no subscriptions, no conventional accounts. Choose your reciter and your surah, and listen.',
    how: {
      title: 'How does Tilawah work?',
      p1: 'Tilawah does not rely on one server to carry the sound. It uses WebTorrent to exchange pieces of a recording between listeners, so your device receives the audio from other devices playing the same recording, and can share back the pieces it received.',
      p2: 'You do not wait for the surah to finish downloading: playback starts as the first pieces arrive, and you can seek forward and back while it downloads.',
    },
    noPeers: {
      title: 'What if nobody else is listening?',
      p1: 'If Tilawah finds no peers within 8 seconds, it starts fetching the pieces from the project server, capped at 1 MB/s per connection.',
      p2: 'The connection to the server stays open after peers appear, so playback does not stop when the other devices cannot supply a piece — which matters most on a phone, where the connection changes as you move between Wi-Fi and mobile data.',
      p3: 'Pieces your device receives from the server can be shared with other listeners, so your device may itself become a source of the audio.',
    },
    ring: {
      title: 'Syncing your devices',
      p1: 'Listening to the Quran needs no account. If you want your favourites and settings synced between two devices, create a ring and carry its key across with a QR code.',
      p2: 'The key is generated on your device, and no account service exists that could restore it for you.',
    },
    know: {
      title: 'What you should know',
      items: [
        'Settings, favourites and recently played sync between the devices in a ring.',
        'If you lose every device holding the key, the ring cannot be recovered.',
        'Where you stopped in a surah is kept in this browser alone, and is not synced.',
      ],
    },
    sources: {
      title: 'Recordings and riwayat',
      p1: 'The recordings in Tilawah come from the Itqan community catalogue (itqan.dev), published through its Fanar platform for Quranic content; rights remain with the reciters and publishers.',
      p2: 'The riwaya — Hafs, Warsh, Qalon — appears beside the reciter when it is known; when it is not, no reading is assumed.',
    },
    open: {
      title: 'Open source',
      p1: 'Tilawah is an open-source project: you can read the code and contribute to it.',
      source: 'Source code:',
      report: 'To report a recording that will not play, or a missing reciter:',
    },
    closing:
      'Tilawah keeps listening to the Quran simple, and lets listeners help each other carry the sound — with the project server there when it is needed.',
    license: 'Fonts: IBM Plex Sans Arabic, SIL OFL 1.1. Version',
  },
  privacy: {
    title: 'Privacy',
    items: [
      'Listening needs no account. A ring is optional: connect your devices to one and your settings and favourites sync between them.',
      'No ads, no trackers.',
      'Usage statistics are off until you turn them on. If you do, we learn the reciter, the surah and where the audio came from, and when playback fails. At most once a day we also learn that a device opened the app, with no identifier that could link one day to the next. We do not learn who you are, and we do not keep your IP address.',
      'Where you stopped listening stays in this browser and goes when you clear site data; whatever a ring syncs is held by the sync relay.',
      'Three outbound calls while listening: the reciter catalogue, the torrent network (peers and web seeds), and MP3 links when a reciter has no torrent. Connecting a ring adds a fourth, to the sync relay, and only while it is connected.',
      'Nothing is sold, and nothing about you is sent to a third party.',
    ],
  },
  telemetry: {
    title: 'Usage statistics',
    hint: 'Anonymous, and off until you turn it on.',
    details:
      'If you turn it on, we learn the reciter, the surah and where the audio came from — and when playback fails. At most once a day, we also learn that a device opened the app, with no identifier attached. We do not learn who you are, and we do not keep your IP address. It exists to fix what breaks, not to follow you.',
    enabled: 'On',
    disabled: 'Off',
    nudge: 'Help us with usage statistics? It carries no name, and nothing is sent before you agree.',
    accept: 'Turn on',
    later: 'Not now',
    consent: 'I agree to send anonymous usage statistics',
  },
};

export const MESSAGES: Record<Locale, typeof ar> = { ar, en };
export type Messages = typeof ar;

export function normaliseLocale(value: unknown): Locale {
  return value === 'en' ? 'en' : 'ar';
}

export const DIRECTION: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', en: 'ltr' };
