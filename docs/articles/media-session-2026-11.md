# التحكم في التلاوة من شاشة القفل ومن نظام التشغيل

أُضيف إلى تلاوة تكاملاً أعمق مع واجهة الوسائط في نظام التشغيل: بيانات الوسائط (metadata: عنوان السورة والقارئ وصورة التطبيق)، ومعالجات Play/Pause/Next/Previous/Stop/Seek (±10 ثوانٍ وSeek-to)، ومزامنة موضع التشغيل مع شريط التقدم في النظام (setPositionState). كما أصبح التحميل المسبق (preload) يحترم وضع توفير البيانات (Save-Data) والشبكات البطيئة (2g/slow-2g) والبطارية المنخفضة.

## ما الذي تغيّر

- **شاشة القفل / مركز الإشعارات / مفاتيح الوسائط** (Bluetooth، لوحة المفاتيح) تُظهر الآن عنوان السورة والقارئ وصورة التطبيق، وتتيح Play/Pause/Next/Previous/Stop/Seek (±10 ثوانٍ) وSeek-to.
- **شريط التقدم (scrubber) في نظام التشغيل** مُزامَن مع موضع التشغيل (setPositionState)، فلا يبقى خاملاً.
- **حالة التشغيل (playbackState)** تُرسل للنظام (playing/paused) للحفاظ على تزامن واجهة المستخدم.
- **صورة متعددة الأحجام** (192/512/maskable) ليختار النظام الأوضح.
- **preload** يصبح 'none' في Save-Data أو 2g/slow-2g أو بطارية < 15% غير شاحنة، لحماية البيانات والبطارية.

## كيف تجرّب

1. شغّل سورة، ثم استخدم عناصر تحكم النظام: شاشة القفل، مفاتيح الوسائط، سماعات Bluetooth.
2. تحقّق من مزامنة شريط التقدم (seek) مع موضع التشغيل.
3. على اتصال محدود أو وضع توفير البيانات، لن يُحمَّل metadata مسبقاً (preload="none").

## ملاحظات

- **Windows (Edge):** تظهر عناصر التحكم عبر واجهة الوسائط (Media Session API) في Edge (الإصدار 79+). للتشغيل في الخلفية (minimized) في PWA مثبتة، فعّل «Continue running background apps» في إعدادات Edge. التكامل الأصلي (UWP/SMTC) محجوز للبناء المُغلَّف (MSIX) — غير مفعّل في بناء الويب.
- **iOS Safari:** دعم محدود (metadata قد يظهر، artwork يتفاوت حسب الإصدار).
- **Android:** دعم كامل (Chrome/Edge/Samsung Internet) — notification shade + lock screen.

## المراجع

- Media Session API (W3C): metadata + action handlers + position state.
- web.dev «Fast playback with audio and video preload»: battery/network awareness.
- Microsoft Tech Community: «Playing a media stream in background in a PWA on Windows 10» (UWP/SMTC).