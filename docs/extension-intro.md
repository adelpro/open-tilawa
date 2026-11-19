# Tilawah Companion — what it is

A browser extension that keeps the Qur'an recitations you choose and shares them
with Tilawa listeners, while the browser runs.

**Why it exists.** Tilawa streams from one server and from other listeners'
browsers. A browser can only swap pieces with another browser over WebRTC, so
listeners are the only peers that can help each other — and the tracker shows how
thin that swarm is. A seeder node helps, but it needs Docker and a machine that
stays on. This is the middle: one click, no daemon, no tab left open.

**What it asks.** Disk and part of your upload, both capped by you — how many
reciters (two by default), the upload rate (1 Mbps), and the hours it may run.
Nothing is pre-ticked, and a new reciter is a notification, not a download.

**What it never does.** No account, no persistent identifier, no analytics, no
reading of pages, tabs or history. It contacts two hosts: the public catalogue
once a day, and the site's torrent files and audio when you download a reciter.

**Status.** 0.2.5. Live on Edge and on Firefox AMO since 2026-11-19; Chrome is
still in review. P1 (a ten-minute idle session in Firefox) remains unrun on the
build machine.

---

## بالعربية

إضافة للمتصفح تحفظ تلاوات القرآن التي تختارها، وتشاركها مع مستمعي تلاوة ما دام المتصفح يعمل.

**لماذا.** تلاوة تبثّ من خادم واحد ومن متصفحات المستمعين. والمتصفح لا يتبادل الأجزاء إلا مع متصفح مثله، فالمستمعون وحدهم يمكنهم أن يساعد بعضهم. العقدة تحلّ ذلك لكنها تحتاج دوكر وجهازًا يبقى مشتغلًا؛ هذه الإضافة هي الوسط: نقرة واحدة، بلا خدمة تعمل في الخلفية، وبلا تبويب يبقى مفتوحًا.

**ما تطلبه.** مساحة على القرص وجزءًا من سرعة الرفع، وكلاهما بحدّ تختاره: عدد القرّاء (اثنان افتراضيًا)، وسرعة الرفع، والمواعيد. ولا شيء محدّد سلفًا، والقارئ الجديد إشعار لا تنزيل.

**ما لا تفعله.** لا حساب، ولا معرّف دائم، ولا إحصاءات، ولا قراءة للصفحات أو التبويبات أو السجلّ. تتصل بموضعين: الفهرس العلني مرة في اليوم، وملفات الموقع وصوته عند التنزيل.
