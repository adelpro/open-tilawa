/**
 * Privacy and terms, as data.
 *
 * Two renderings come out of this file: the About section inside the extension,
 * and `site/privacy.html` / `site/terms.html` for the store listings. A
 * hand-kept second copy is a promise that drifts — a reviewer reading the Pages
 * URL and a person reading the About screen must see the same words.
 *
 * Arabic first, English second, both in the site's voice: short sentences, no
 * legalese, and no promise the code does not keep. The Arabic was gated through
 * uslub (voice-adel) when this text moved here.
 */

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; lede: string; sections: LegalSection[] };

export type Legal = { ar: LegalDoc; en: LegalDoc };

const CONTACT = 'contact@tilawah.cc';

export const PRIVACY: Legal = {
  ar: {
    title: 'الخصوصية',
    lede: 'ما يحتفظ به رفيق تلاوة على جهازك، وما يرسله إلى الشبكة، وما لا يفعله أبدًا.',
    sections: [
      {
        heading: 'ما يحتفظ به على جهازك',
        body: [
          'التلاوات التي تختارها أو تتابعها، وإعداداتك: نمط الحفظ، وعدد القرّاء، وحدّ الرفع، ومواعيد التوقّف. لا شيء غير ذلك.',
          'في نمطَي المتابعة والمختلط، يخبر تلاوةُ الإضافةَ بما تستمع إليه: رسالة واحدة عند بدء تشغيل قارئ، تبقى على جهازك ولا تمرّ من الإضافة إلى أيّ طرف ثالث.',
          'إزالة قارئ تحذف نسخته من هذا الجهاز. وإزالة الإضافة تحذف كل ما حفظته.',
        ],
      },
      {
        heading: 'ما يفعله على الشبكة',
        body: [
          'يتصل بثلاثة مواضع فقط: فهرس القرّاء في تلاوة مرة واحدة في اليوم، وملفات التلاوات وصوتها عند التنزيل، وشبكة التورنت التي تُعلن عنك كقرين.',
          'ما دام المتصفح يعمل، يشارك جهازك الأجزاء التي نزّلها مع مستمعي تلاوة. ويرى أولئك عنوان IP لجهازك، أو عنوان المرحّل إن مرّ الاتصال به. ويراه المتتبّع أيضًا، كما هو الحال مع أي عميل تورنت. وملف التورنت يحمل متتبّعات عامة إلى جانب متتبّع تلاوة، فيصل إليها المعرّف المؤقّت نفسه.',
        ],
      },
      {
        heading: 'ما لا يفعله',
        body: [
          'لا حساب ولا معرّف دائم ولا إحصاءات ولا إعلانات. ولكل عميل تورنت معرّف مؤقّت عشوائي في البروتوكول، يتغيّر كل جلسة ولا يدلّ عليك.',
          'لا يقرأ صفحاتك، ولا تبويباتك، ولا سجلّ تصفّحك.',
          'لا يبيع شيئًا، ولا يرسل شيئًا عنك إلى طرف ثالث.',
        ],
      },
      {
        heading: 'الأذونات، بلغة واضحة',
        body: [
          'التخزين ليحفظ التلاوات التي اخترتها. وتخزين غير محدود لأن تلاوة واحدة أكبر من المساحة المعتادة لموقع.',
          'المنبّهات لفحص الفهرس مرة واحدة في اليوم، والإشعارات ليخبرك بقارئ جديد إن أردت.',
          'النافذة الخفية في كروم لتستمر المشاركة والمتصفح يعمل.',
        ],
      },
      {
        heading: 'إن غيّرت رأيك',
        body: ['أوقف المشاركة من النافذة، أو أزل قارئًا من الإعدادات، أو أزل الإضافة. كل واحدة منها تكفي.'],
      },
    ],
  },
  en: {
    title: 'Privacy',
    lede: 'What Tilawah Companion keeps on your device, what it sends to the network, and what it never does.',
    sections: [
      {
        heading: 'What it keeps on your device',
        body: [
          'The recitations you choose or follow, and your settings: the holding mode, how many reciters, the upload limit, the hours you allow. Nothing else.',
          'In Follow and Mixed modes, tilawah.cc tells the add-on what you play — one message when a reciter starts. It stays on your device; the add-on never passes it to anyone.',
          'Removing a reciter deletes its copy from this device. Uninstalling the extension deletes everything it kept.',
        ],
      },
      {
        heading: 'What it does online',
        body: [
          'It contacts three places only: the reciter list at tilawah.cc once a day, the torrent file and its audio while downloading, and the torrent network, which announces you as a peer.',
          "While the browser runs, your device shares the pieces it holds with Tilawa listeners. Those peers see your IP address — or the relay's, if the connection goes through one. The tracker sees it too, as it would for any torrent client. The torrent file also lists public trackers beside Tilawa's, and the same per-session peer id reaches them.",
        ],
      },
      {
        heading: 'What it never does',
        body: [
          'No account, no persistent identifier, no analytics, no ads. Like every torrent client, it sends a random per-session protocol peer id that changes each run and names nobody.',
          'It does not read your pages, your tabs, or your browsing history.',
          'Nothing is sold, and nothing about you is sent to a third party.',
        ],
      },
      {
        heading: 'Permissions, in plain words',
        body: [
          "Storage holds the recitations you chose; unlimited storage is there because one recitation is larger than a website's allowance.",
          'Alarms check the roster once a day; notifications tell you about a new reciter if you want that.',
          'The offscreen document (Chrome only) keeps sharing alive while the browser runs.',
        ],
      },
      {
        heading: 'If you change your mind',
        body: [
          'Pause it from the popup, remove a reciter in the settings, or uninstall the extension. Any one of those is enough.',
        ],
      },
    ],
  },
};

export const TERMS: Legal = {
  ar: {
    title: 'الشروط',
    lede: 'شروط قصيرة، بلا لغة قانونية: ما تعطيه، وما لا نضمنه، وكيف تتوقّف.',
    sections: [
      {
        heading: 'ما تفعله الإضافة',
        body: [
          'تحفظ على جهازك التلاوات التي تختارها، وتشارك أجزاءها مع مستمعي تلاوة عبر المتصفح، ما دام المتصفح يعمل.',
        ],
      },
      {
        heading: 'ما تعطيه أنت',
        body: [
          'مساحة على قرصك، وجزءًا من سرعة رفعك. الحدّان بيدك: عدد القرّاء، وسرعة الرفع، والمواعيد التي تسمح فيها بالمشاركة. لا شيء منها إلزامي.',
        ],
      },
      {
        heading: 'ما لا نضمنه',
        body: [
          'تُقدَّم الإضافة كما هي، دون ضمان. قد تتوقّف المشاركة إن أُغلق المتصفح أو انقطع الاتصال أو امتلأ القرص، ولا نضمن سرعة معيّنة ولا توفّر التلاوات دائمًا.',
        ],
      },
      {
        heading: 'التلاوات',
        body: [
          'التلاوات مسجّلات تُوزَّع على نطاق واسع، والإضافة لا تمنحك حقوقًا فيها ولا تدّعيها. وأسماء القرّاء مذكورة للتعرّف فقط، ولا تعني تبنّيهم لهذه الإضافة.',
        ],
      },
      {
        heading: 'التوقّف والتغييرات',
        body: [
          'أوقف المشاركة من النافذة، أو أزل قارئًا من الإعدادات، أو أزل الإضافة. الإزالة تحذف ما حفظته.',
          'تتغيّر هذه الصفحة مع الإضافة، وتاريخ آخر تعديل مذكور في تذييلها.',
        ],
      },
    ],
  },
  en: {
    title: 'Terms',
    lede: 'Short terms, without legal language: what you give, what is not promised, and how to stop.',
    sections: [
      {
        heading: 'What the extension does',
        body: [
          'It keeps the recitations you choose on your device and shares their pieces with Tilawa listeners through the browser, while the browser runs.',
        ],
      },
      {
        heading: 'What you give',
        body: [
          'Disk space and a share of your upload. Both are capped by you: how many reciters, the upload rate, and the hours you allow. None of it is required.',
        ],
      },
      {
        heading: 'What is not promised',
        body: [
          'The extension is provided as is, without warranty. Sharing may stop if the browser closes, the connection drops, or the disk fills. No particular speed is guaranteed, and no recitation is guaranteed to stay available.',
        ],
      },
      {
        heading: 'The recitations',
        body: [
          'The recordings are widely distributed, and the extension neither grants nor claims rights over them. Reciter names identify the recordings; they do not imply endorsement.',
        ],
      },
      {
        heading: 'Stopping and changes',
        body: [
          'Pause from the popup, remove a reciter in the settings, or uninstall the extension. Uninstalling deletes what it kept.',
          'This page changes with the extension; the date of the last edit is in its footer.',
        ],
      },
    ],
  },
};

export const LEGAL_UPDATED = '15 November 2026';
export const LEGAL_CONTACT = CONTACT;

export const SUGGEST_SUBJECT = {
  ar: 'اقتراح قارئ لـ تلاوة',
  en: 'Reciter suggestion for Tilawah',
};

export const SUGGEST_BODY = {
  ar: 'الاسم:\nالرواية:\nرابط التلاوات (إن وُجد):\nملاحظات:',
  en: 'Name:\nRiwaya:\nLink to the recitations (if any):\nNotes:',
};
