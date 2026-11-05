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
    hint: 'Space للتشغيل · ←/→ 15 ثانية · اضغط مع الاستمرار على أيقونة الصوت للكتم · ؟ للمزيد',
    dismiss: 'إخفاء',
  },
  routes: {
    listen: 'الاستماع',
    settings: 'الإعدادات',
    about: 'عن تلاوة',
    privacy: 'الخصوصية',
    seed: 'شغّل عقدة',
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
  reciterPage: {
    lede: (name: string) => `استمع إلى سور القرآن كلها بصوت ${name}.`,
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
    share: 'المشاركة مع المستمعين',
    shareHint:
      'ما دامت الصفحة مفتوحة، يشارك جهازك الأجزاء التي نزّلها مع مستمعين آخرين. إيقاف المشاركة لا يغيّر الاستماع ولا التنزيل.',
    shareOn: 'مفعّلة',
    shareOff: 'معطّلة',
    minutes: (count: number) => `${count} د`,
  },
  shapes: { bars: 'أعمدة', peaks: 'قِمم', ribbon: 'شريط' } as Record<string, string>,
  footer: {
    list: 'قائمة السور',
    reciter: 'اختيار القارئ',
    volume: 'مستوى الصوت',
    volumeMuted: 'مستوى الصوت، مكتوم',
    muted: 'مكتوم',
    unmuted: 'غير مكتوم',
    fullscreen: 'ملء الشاشة',
    exitFullscreen: 'إنهاء ملء الشاشة',
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
  home: {
    page: (n: number) => `الصفحة ${n}`,
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
    faq: {
      title: 'أسئلة شائعة',
      items: [
        {
          q: 'هل تلاوة مجانية؟',
          a: 'نعم. تلاوة مجانية بلا إعلانات ولا اشتراكات، ولا تحتاج إلى حساب للاستماع.',
        },
        {
          q: 'من أين تأتي التسجيلات؟',
          a: 'من كتالوج مجتمع إتقان (itqan.dev) عبر منصّة «فنار» لنشر المحتوى القرآني، والحقوق تعود إلى أصحابها من القرّاء والناشرين.',
        },
        {
          q: 'هل أحتاج إلى حساب؟',
          a: 'لا. الحساب غير مطلوب للاستماع؛ وإذا أردت مزامنة المفضّلة والإعدادات بين أجهزتك، أنشئ حلقة وانقل مفتاحها برمز QR.',
        },
        {
          q: 'ماذا يحدث إن لم يكن هناك مستمعون آخرون؟',
          a: 'يجلب المشغّل الأجزاء من خادم المشروع بعد ثماني ثوانٍ بلا أقران، بحدّ أقصى مقداره 1 ميغابايت في الثانية للاتصال الواحد، ويستمر التشغيل.',
        },
        {
          q: 'هل يعمل على الهاتف؟',
          a: 'نعم. يعمل في متصفح الهاتف، ويمكن تثبيته تطبيقاً على أندرويد وiOS.',
        },
        {
          q: 'كيف أساهم أو أبلّغ عن مشكلة؟',
          a: 'الشيفرة المصدرية على GitHub، وللإبلاغ عن تسجيل لا يعمل أو قارئ ناقص راسلنا على contact@tilawah.cc.',
        },
      ],
    },
    open: {
      title: 'مشروع مفتوح المصدر',
      p1: 'تطبيق تلاوة مشروع مفتوح المصدر: يمكنك الاطلاع على الشيفرة والمساهمة في تطويرها.',
      source: 'الشيفرة المصدرية:',
      report: 'للإبلاغ عن تسجيل لا يعمل أو قارئ ناقص:',
    },
    contribute: {
      title: 'ساهم بعقدة',
      body: 'إن كان لديك جهاز لينكس يبقى يعمل، يمكنك أن تحتفظ بنسخة من التلاوات وتبثّها للمستمعين.',
      link: 'اعرف كيف',
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
      'إحصاءات الاستخدام معطّلة حتى تشغّلها. وإن شغّلتها، عرفنا القارئ والسورة، ومن أين جاء الصوت، وهل تعطّل التشغيل؛ ولا نعرف من أنت، ولا نحتفظ بعنوان IP. ومرّة واحدة في اليوم على الأكثر، يصلنا أنّ جهازاً فتح التطبيق، مع فئة عمر الجهاز منذ أول فتح، بلا معرّف يربط الأيام بعضها ببعض.',
      'موضع توقّفك في كل سورة محفوظ في هذا المتصفح وحده: لا يصل إلى الحلقة، ولا ينتقل إلى أجهزتك الأخرى، ولكل جهاز موضعه. يبقى حتى تمسح بيانات الموقع، فإذا مسحتها ذهب معها.',
      'أثناء الاستماع لا يتصل جهازك إلا بثلاثة: كتالوج القرّاء، وشبكة التورنت، وروابط MP3 إن لم يكن للقارئ ملف تورنت. والحلقة تضيف اتصالاً رابعاً بخادم المزامنة.',
      'ما دامت الصفحة مفتوحة، يشارك جهازك الأجزاء التي نزّلها مع مستمعين آخرين. ويرى أولئك عنوان IP لجهازك، أو عنوان المرحّل إن مرّ الاتصال به. ويراه المتتبّع أيضاً، كما هو الحال مع أي عميل تورنت. وإغلاق التبويب يوقف ذلك.',
      'لا نبيع شيئاً، ولا نرسل شيئاً عنك إلى طرف ثالث.',
    ],
  },
  seedPage: {
    title: 'شغّل عقدة',
    lede: 'احتفظ بنسخة من التلاوات وابثّها للمستمعين. أمر واحد، وحدّ للتخزين، وحدّ للرفع، فتصبح الشبكة أقرب إلى من يحتاجها.',
    why: {
      title: 'لماذا عقدة؟',
      p1: 'لوحة التحكم لا تحفظ صوتاً. كل عقدة تحتفظ بالمكتبة وتبثّ أجزاءها إلى المستمعين عبر BitTorrent؛ وهناك عقدتان تعملان الآن.',
      p2: 'عقدة على شبكة أخرى أثمن من مئة تنزيل: تقرّب الصوت من مستمعين لا يصلهم خادمنا بسرعة.',
    },
    supported: {
      title: 'ما المدعوم؟',
      linux: 'لينكس: مدعوم. أوبنتو أو دبيان مع Docker، على جهاز احتياطي أو خادم صغير.',
      windows: 'ويندوز: تجريبي عبر WSL2 وDocker Desktop. قد لا تصل اللوحة إلى العقدة، فجهاز لينكس أسلم.',
      mac: 'ماك: غير مدعوم بعد.',
    },
    linux: {
      title: 'على لينكس',
      intro: 'ثبّت Docker ثم شغّل الأمر. يثبّت في /opt ويطبع القيم الأربع التي تطلبها اللوحة.',
      requirements: [
        'جهاز يبقى يعمل، وفيه نحو 20 غيغابايت حرة.',
        'Docker وصلاحية sudo.',
        'المنفذ 6881 مفتوح على الموجّه.',
        'اختياري: Tailscale على الجهاز وعلى مضيف اللوحة، لعنوان لا يتغيّر مع تغيّر IP.',
      ],
      commandTitle: 'ثبّت وشغّل',
      commandHint: '50 غيغابايت من التخزين و20 ميغابت في الثانية للرفع. أخفض الرفع على اتصال منزلي؛ العقدة لا تتجاوز الحدّ.',
      portTitle: 'افتح منفذ الأقران',
      portHint: 'هذا المنفذ الوحيد الذي يجب فتحه على الإنترنت. لا تفتح 8085: فهو يستقبل بيانات الدخول ويبقى على الشبكة المحلية أو Tailscale.',
      afterTitle: 'ما يطبعه المثبّت',
      afterBody: 'الاسم والعنوان واسم المستخدم وكلمة المرور. أرسلها إلى المسؤول، أو أضفها بنفسك من اللوحة.',
    },
    windows: {
      title: 'ويندوز عبر WSL2',
      warning: 'تجريبي. يفتح Docker Desktop منفذ الأقران، لكن شبكة WSL قد تمنع اللوحة من الوصول إلى 8085. إن لم تستجب، فاستخدم جهاز لينكس.',
      command: 'wsl --install -d Ubuntu',
      commandTitle: 'ثبّت WSL2 وأوبنتو',
      commandHint: 'في PowerShell بصلاحية مسؤول، ثم أعد التشغيل.',
      steps: [
        { title: 'شغّل الأمر أعلاه.', body: 'من PowerShell بصلاحية مسؤول، ثم أعد التشغيل.' },
        { title: 'ثبّت Docker Desktop.', body: 'فعّل Settings ثم Resources ثم WSL Integration لأوبنتو.' },
        { title: 'شغّل أمر لينكس داخل أوبنتو.', body: 'نفس الأمر أعلاه، من طرفية أوبنتو.' },
        { title: 'افتح المنفذ.', body: 'افتح 6881 TCP وUDP في جدار ويندوز، ومرّره على الموجّه. أبقِ 8085 على Tailscale أو الشبكة المحلية.' },
      ],
      note: 'ماك غير مدعوم: المثبّت يفترض لينكس.',
    },
    console: {
      title: 'أضفها إلى اللوحة',
      p1: 'افتح صفحة Seeders، ثم Add seeder، وألصق القيم الأربع. تفحص اللوحة العقدة، وتعرض تلاواتها وأقرانها، وتستطيع دفع المكتبة المنشورة إليها.',
      p2: 'لا تملك صلاحية اللوحة؟ أرسل القيم إلى contact@tilawah.cc ونضيفها.',
      link: 'افتح Seeders',
      imageAlt: 'صفحة Seeders في لوحة التحكم: عقدتان متصلتان، لكل منهما عشر تلاوات، وأعداد الأقران.',
      imageCaption: 'صفحة Seeders: العقدتان متصلتان، ولكل عقدة عشر تلاوات وأعداد الأقران.',
    },
    limits: {
      title: 'الحدود والسلامة',
      items: [
        { title: 'التخزين', body: '--disk 50 يحدّ البيانات. المكتبة كاملة نحو 18 غيغابايت.' },
        { title: 'الرفع', body: '--upload-kbps 20000 يحدّ الرفع بـ20 ميغابت في الثانية؛ أخفضه على اتصال منزلي.' },
        { title: 'الإيقاف', body: 'إيقاف الحاوية يوقف المشاركة. ويمكن للوحة حذف العقدة.' },
        { title: 'الأمان', body: '8085 للإدارة ويبقى خاصاً، و6881 وحده عام. كلمة المرور تُطبع مرة واحدة.' },
      ],
    },
    faq: {
      title: 'أسئلة متكررة',
      items: [
        { q: 'هل أحتاج خادماً؟', a: 'جهاز لينكس احتياطي أو خادم صغير. الاتصال المنزلي يعمل مع الحدود.' },
        { q: 'كم يستهلك من النطاق؟', a: 'ابدأ بـ20 ميغابت في الثانية، وأخفضه إن تأثر الاتصال.' },
        { q: 'هل يبطئ حاسوبي؟', a: 'الحدود هي السقف؛ العقدة تبقى خاملة حين لا أحد يستمع.' },
        { q: 'كيف أزيلها؟', a: 'احذف العقدة من اللوحة، ثم docker compose down في مجلد التثبيت.' },
      ],
    },
    copy: 'انسخ',
    copied: 'نُسخ',
    copyFailed: 'تعذّر النسخ',
    closing: 'مثبّت لينكس هو الطريق المدعوم اليوم. العميل المكتبي مخطط بعد المرحلة التجريبية، بلا موعد.',
  },
  telemetry: {
    title: 'إحصاءات الاستخدام',
    hint: 'لا تحمل اسمك، وتبقى معطّلة حتى تشغّلها.',
    details:
      'إن شغّلتها، وصلنا اسم القارئ والسورة ومصدر الصوت، وإن تعطّل التشغيل وصلنا الخبر. ومرّة واحدة في اليوم على الأكثر، وصلنا أنّ جهازاً فتح التطبيق، مع فئة عمره منذ أول فتح، بلا معرّف. لا يصلنا اسمك، ولا نحتفظ بعنوان IP. ليس المقصود تتبّعك، بل معرفة ما ينكسر.',
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
    hint: 'Space to play · ←/→ 15 seconds · hold the speaker to mute · ? for more',
    dismiss: 'Dismiss',
  },
  routes: {
    listen: 'Listen',
    settings: 'Settings',
    about: 'About Tilawah',
    privacy: 'Privacy',
    seed: 'Run a node',
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
  reciterPage: {
    lede: (name: string) => `Listen to every surah of the Quran in the voice of ${name}.`,
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
    share: 'Sharing with listeners',
    shareHint:
      'While the page is open, your device shares the pieces it has downloaded with other listeners. Turning it off changes neither listening nor downloading.',
    shareOn: 'On',
    shareOff: 'Off',
    minutes: (count: number) => `${count} min`,
  },
  shapes: { bars: 'Bars', peaks: 'Peaks', ribbon: 'Ribbon' },
  footer: {
    list: 'Surah list',
    reciter: 'Choose reciter',
    volume: 'Volume',
    volumeMuted: 'Volume, muted',
    muted: 'Muted',
    unmuted: 'Unmuted',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
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
  home: {
    page: (n: number) => `Page ${n}`,
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
    faq: {
      title: 'Frequently asked questions',
      items: [
        {
          q: 'Is Tilawah free?',
          a: 'Yes. Tilawah is free, with no adverts, no subscriptions, and no account needed to listen.',
        },
        {
          q: 'Where do the recordings come from?',
          a: 'From the Itqan community catalogue (itqan.dev), published through its Fanar platform for Quranic content. Rights remain with the reciters and publishers.',
        },
        {
          q: 'Do I need an account?',
          a: 'No. Listening needs no account. To sync favourites and settings between your devices, create a ring and carry its key across with a QR code.',
        },
        {
          q: 'What happens when nobody else is listening?',
          a: 'After eight seconds without peers, the player fetches the pieces from the project server, capped at 1 MB/s per connection, and playback continues.',
        },
        {
          q: 'Does it work on a phone?',
          a: 'Yes. It runs in the phone browser and can be installed as an app on Android and iOS.',
        },
        {
          q: 'How can I contribute or report a problem?',
          a: 'The source is on GitHub. To report a recording that will not play or a missing reciter, write to contact@tilawah.cc.',
        },
      ],
    },
    open: {
      title: 'Open source',
      p1: 'Tilawah is an open-source project: you can read the code and contribute to it.',
      source: 'Source code:',
      report: 'To report a recording that will not play, or a missing reciter:',
    },
    contribute: {
      title: 'Contribute a node',
      body: 'If you have a Linux machine that stays on, you can keep a copy of the recitations and stream it to listeners.',
      link: 'How it works',
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
      'Usage statistics are off until you turn them on. If you do, we learn the reciter, the surah and where the audio came from, and when playback fails. At most once a day we also learn that a device opened the app, with the age range since its first open — and still no identifier that could link one day to the next. We do not learn who you are, and we do not keep your IP address.',
      'Where you stopped listening stays in this browser and goes when you clear site data; whatever a ring syncs is held by the sync relay.',
      'Three outbound calls while listening: the reciter catalogue, the torrent network (peers and web seeds), and MP3 links when a reciter has no torrent. Connecting a ring adds a fourth, to the sync relay, and only while it is connected.',
      'While the page is open, your device shares the pieces it has with other listeners. Those peers see your IP address — or the relay’s, if the connection goes through it. The tracker sees it too, as it would for any torrent client. Closing the tab stops it.',
      'Nothing is sold, and nothing about you is sent to a third party.',
    ],
  },
  seedPage: {
    title: 'Run a node',
    lede: 'Keep a copy of the recitations and stream it to listeners. One command, a disk cap, an upload cap — and the network is closer to the people who need it.',
    why: {
      title: 'Why a node?',
      p1: 'The console stores no audio. Each node keeps the catalogue and serves pieces to listeners over BitTorrent; two nodes already run.',
      p2: 'A node on another network is worth more than a hundred downloads: it shortens the path for listeners your server cannot reach quickly.',
    },
    supported: {
      title: 'What is supported?',
      linux: 'Linux: supported. Ubuntu or Debian with Docker, on a spare machine or a small VPS.',
      windows: 'Windows: experimental through WSL2 and Docker Desktop. The console may not reach the node, so a Linux box is safer.',
      mac: 'macOS: not supported yet.',
    },
    linux: {
      title: 'On Linux',
      intro: 'Install Docker, then run this. The installer writes to /opt and prints the four values the console asks for.',
      requirements: [
        'A machine that stays on, with about 20 GB free.',
        'Docker, and root (sudo).',
        'Port 6881 open on the router.',
        'Optional: Tailscale on this machine and the console host, for an address that survives an IP change.',
      ],
      commandTitle: 'Install and start',
      commandHint: '50 GB of disk and 20 Mbps of upload. Lower the upload on a home connection; the node never uses more than the cap.',
      portTitle: 'Open the peer port',
      portHint: 'This is the only port the internet needs. Do not open 8085: it answers admin credentials and stays on the LAN or tailnet.',
      afterTitle: 'What the installer prints',
      afterBody: 'Name, URL, user and password. Send them to the operator, or add them yourself in the console.',
    },
    windows: {
      title: 'Windows through WSL2',
      warning: 'Experimental. Docker Desktop publishes the peer port, but WSL’s network can stop the console reaching 8085. If it does not answer, use a Linux machine.',
      command: 'wsl --install -d Ubuntu',
      commandTitle: 'Install WSL2 and Ubuntu',
      commandHint: 'In an elevated PowerShell, then reboot.',
      steps: [
        { title: 'Run the command above.', body: 'In an elevated PowerShell, then reboot.' },
        { title: 'Install Docker Desktop.', body: 'Enable Settings → Resources → WSL Integration for Ubuntu.' },
        { title: 'Run the Linux command in Ubuntu.', body: 'The same command as above, inside the Ubuntu terminal.' },
        { title: 'Open the port.', body: 'Allow 6881 TCP and UDP in Windows Defender Firewall, and forward it on the router. Keep 8085 on the tailnet or LAN.' },
      ],
      note: 'macOS is not supported: the installer assumes Linux.',
    },
    console: {
      title: 'Add it to the console',
      p1: 'Open Seeders, choose Add seeder, and paste the four values. The console probes the node, shows its torrents and peers, and can push the published catalogue.',
      p2: 'No console access? Send the values to contact@tilawah.cc and we will add it.',
      link: 'Open Seeders',
      imageAlt: 'The Seeders page in the console: two nodes online, ten recitations each, with peer counts.',
      imageCaption: 'The Seeders page: two nodes online, ten recitations each, with peer counts.',
    },
    limits: {
      title: 'Limits and safety',
      items: [
        { title: 'Disk', body: '--disk 50 caps the data. The full catalogue is about 18 GB.' },
        { title: 'Upload', body: '--upload-kbps 20000 caps the uplink at 20 Mbps; lower it for a home connection.' },
        { title: 'Stop', body: 'Stopping the container stops sharing. The console can remove the node.' },
        { title: 'Security', body: '8085 is admin and stays private; 6881 is the only public port. The password is printed once.' },
      ],
    },
    faq: {
      title: 'Questions',
      items: [
        { q: 'Do I need a server?', a: 'A spare Linux machine or a small VPS. A home connection works with the caps.' },
        { q: 'How much bandwidth?', a: 'Start at 20 Mbps and lower it if the connection suffers.' },
        { q: 'Will it slow my computer?', a: 'The caps are the limit; the node is idle when nobody is listening.' },
        { q: 'How do I remove it?', a: 'Remove the node in the console, then run docker compose down in the install directory.' },
      ],
    },
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    closing: 'The Linux installer is the supported path today. A desktop client is planned after the alpha; there is no date.',
  },
  telemetry: {
    title: 'Usage statistics',
    hint: 'Anonymous, and off until you turn it on.',
    details:
      'If you turn it on, we learn the reciter, the surah and where the audio came from — and when playback fails. At most once a day, we also learn that a device opened the app, with the age range since its first open, and no identifier attached. We do not learn who you are, and we do not keep your IP address. It exists to fix what breaks, not to follow you.',
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
