# Release 0.2.1 — files and steps

## Files to upload

| Store | File | What it is |
| --- | --- | --- |
| Microsoft Edge Add-ons | `store/tilawah-companion-0.2.1-edge.zip` | the built MV3 extension, `npm run zip` — Edge takes the Chrome package unchanged |
| Chrome Web Store | `tilawah-companion-0.2.1-chrome.zip` | the same MV3 build (`.output/`), for when the 0.2.0 review clears |
| Firefox AMO | `tilawah-companion-0.2.1-firefox.zip` | the built MV2 extension, `npm run zip:firefox` |

Regenerate any time with:

```bash
cd apps/extension
npm run build && npm run zip            # Chrome / Edge
npm run build:firefox && npm run zip:firefox   # Firefox
cp .output/tilawah-companion-0.2.1-chrome.zip store/tilawah-companion-0.2.1-edge.zip
```

## Steps, in order

0. **Edge update (0.2.1, today).** Upload `store/tilawah-companion-0.2.1-edge.zip` in Partner Center →
   Packages → Update, paste the 0.2.1 release notes (English and Arabic below), submit. The listing,
   screenshots and forms carry over from 0.2.0.
1. **Firefox first — when its 0.2.0 review clears.** AMO is free, review is human, and a signed build can be installed in release Firefox. Upload the zip at `addons.mozilla.org/developers/`, choose **On this site** (listed) only after P1 passes; for testing use **On your own** (unlisted).
2. **P1 gate.** Ten minutes with Firefox seeding, then read `tracker.tilawah.cc/stats`. Still recorded as NOT RUN in `docs/PROBES.md`. Do not publish on AMO before it passes.
3. **Chrome — when its 0.2.0 review clears.** Upload the zip, category **Productivity**, visibility **Public**, fill the privacy practices form from `store/store-fields.md`, add the five screenshots.
4. **Source archive (AMO).** The bundle is minified, so AMO will ask for readable source: upload a zip of `apps/extension` (without `node_modules`, `.output`) plus a line saying `npm install && npm run build:firefox`.
5. **After all three clear — set the links.** `src/constants/brand.ts` `edgeStore` is filled (0.2.1); `chromeStore` and `firefoxAddons` stay empty until their listings exist. Fill them, rebuild, and ship the next patch. The same day, add the missing links to the site's `/seed` page and to `apps/extension/README.md`.

## Release notes — 0.2.1 (paste into Partner Center → "What's new")

**English**

```
Listening modes. Choose Manual, Follow, or Mixed in settings. In Follow, the companion holds what you play on tilawah.cc — newest first, rotating the oldest under a cap you set. Your own picks are never removed, and neither is the recitation playing right now.

Reciter names are links. Click a name to open that reciter's page on tilawah.cc.

Store link. The About screen now links to this Edge listing.

Privacy text. It now explains the playback notice: one message when a reciter starts, kept on your device, never forwarded.
```

**العربية**

```
أنماط الحفظ. اختر يدوي، أو متابعة، أو مختلط من الإعدادات. في نمط المتابعة يحتفظ رفيق تلاوة بما تستمع إليه على تلاوة، الأحدث أولًا، ويحل الأقدم عند بلوغ الحد الذي تختاره. لا يُحل ما اخترته بنفسك، ولا التلاوة التي تُسمع الآن.

أسماء القرّاء صارت روابط. نقرة واحدة تفتح صفحة القارئ على تلاوة.

رابط المتجر. شاشة «عن الإضافة» تصل إلى صفحة المتجر.

نص الخصوصية. يبيّن الآن رسالة التشغيل: رسالة واحدة عند بدء قارئ، تبقى على جهازك ولا تُمرَّر إلى أي طرف.
```

## Verification — staging, 2026-11-16

Playwright Chromium (rev 1234) + the unpacked 0.2.1 build, against
`https://staging.tilawah.cc` (unpacked id `egjdnohidgpnoghfjnkpmfbjkppjeknp`).
All observed pass: a play notice from the staging origin → reply `{ok: true}`;
the follow row stored first with `source: 'follow'`; the manual row untouched
through cap overflow; a cap of 2 trims the oldest follow row (the C1 guard fix
holds in a real browser); a re-sent reciter refreshes recency without
duplicating. Settings were seeded `paused: true` — the proof moved no bytes.
Users on the store 0.2.0 build cannot follow yet: the sender ships in 0.2.1.

**Closed idea (2026-11-16):** no suggestion mode. Peer-count-driven
recommendations were considered and dropped — the modes are locked at Manual /
Follow / Mixed.

### Debugging the follow channel locally

An unpacked build's ID is derived from its folder path, so the site — which
targets known IDs only — could never reach a debug build (found live:
`Receiving end does not exist` against the Edge ID while the dev build sat on a
path-derived ID). Build a debug package with `TILAWAH_DEV_KEY=1 npm run zip`;
the manifest gains a public key and Chrome derives
`opbhejfgfikjgnckojangiodobblkjfi` on every machine. The site targets that ID
from `staging.tilawah.cc` only. The key must never ship in a store package —
the Web Store may reject a manifest carrying its own key, so store builds omit
it.

## Submission log

| Store | Package | Version | Submitted | Status |
| --- | --- | --- | --- | --- |
| Chrome Web Store | `tilawah-companion-0.2.0-chrome.zip` | 0.2.0 | 2026-11-16 | **in review** |
| Microsoft Edge Add-ons | `UPLOAD-THIS-tilawah-companion-0.2.0-edge.zip` | 0.2.0 | 2026-11-16 | **live** — https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom |
| Firefox AMO | `tilawah-companion-0.2.0-firefox.zip` | 0.2.0 | 2026-11-16 | **in review** |
| Microsoft Edge Add-ons | `store/tilawah-companion-0.2.1-edge.zip` | 0.2.1 | 2026-11-16 | **ready to upload** |

The manifest version is `0.2.1` in every package cut for this release; 0.2.0 stays live on Edge and
in review elsewhere until 0.2.1 replaces it. A store package cannot be replaced once accepted — a
change after approval ships as a further patch.

Package rules learned the hard way:

- The file uploaded to a store is the one whose **zip root is `manifest.json`**. A wrapper zip that
  contains the package is rejected by Edge as "consists of a compressed file".
- AMO requires `browser_specific_settings.gecko.data_collection_permissions` (`{"required":["none"]}`)
  and rejects `import(<variable>)` as an unsafe dynamic import.
- The sources archive is the only separate upload, and it must match the submitted package exactly.

## 0.2.5 — 2026-11-17

**Adding a reciter is the decision; the button is only pause.**

- Adding, unticking or removing a row now writes the roster and starts it in the
  same move. The old commit step made the page lie twice: a ticked row appeared
  under "My reciters" before it was held, and with something already running the
  only button left was "Pause" — so a new row could not be committed at all
  without pausing first.
- Pause/Resume is one control on both surfaces and reads `settings.paused`, which
  both write through the background. The old options-page "start" wrote the stale
  `paused: true` back and stayed stopped while the button said Start.
- The disk and count gates run **before** a row is promised, so an over-budget add
  is refused with its sentence instead of starting a download that cannot fit.
- Adding while paused stores the row and says "Saved. Sharing is paused"; the
  next resume starts it.

## 0.2.4 — 2026-11-17

**First run asks two questions, and the default budget stops fighting the follow
cap.**

- The empty popup is a setup card: mode (manual / follow / mixed) and disk
  budget, written to the same `settings.v1` the options page edits, with one door
  to the picker. The welcome screen stays for the options tab, so the store
  screenshots remain valid.
- Default disk budget **10 GB → 6 GB**. The largest two-reciter pair in the
  catalogue under the default follow cap of 2 is 5.08 GB, so the budget and the
  cap now stack instead of quietly evicting each other. A stored 10 GB is kept —
  a default change does not rewrite someone's choice — and the picker gains 3 and
  6 GB.
- **P5 passes** (2026-11-17, `docs/PROBES.md`): the offscreen document exposes
  `navigator.getBattery`, a 5% unplugged reading pauses seeding, and a 5% charging
  reading does not.
- Carries 0.2.3: the `state:device` fix (battery and metered pauses act), a
  silent first catalogue (no install-day notification), a popup count that
  clears, Arabic notifications, and the «بحاجة إلى مشاركة» strip fed by the
  catalogue's `swarm` block.

## 0.2.3 — 2026-11-17

**A fresh install is silent, the count clears, and the pauses work.**

- **No install-day notification.** The first catalogue a device fetches is its
  baseline, not news: notices begin with the second sync, so a new install is not
  told that twelve reciters "just arrived".
- **The popup count clears.** `pending` now counts notices the background has
  actually produced, and the picker resets it when it renders them. The old
  counter subtracted `notices-opened.v1`, which nothing ever wrote, so it could
  never fall to zero.
- **Notifications speak the browser's language.** The sentences and the batch
  title moved into `lib/i18n.ts` and follow the UI language; the Arabic strings
  passed uslub (fasaha + avoid-ai-writing). `planSync` now names the rows instead
  of writing English text.
- **Pause on battery and pause on metered reach the engine.** `state:device` was
  rejected by the message guard (`isEngineRequest` accepted only `engine:*`), so
  both defaults were rendered checked and ignored at runtime. Fixed in
  `lib/messages.ts`, covered by `test/messages.test.ts`.
- **A reciter worth seeding.** The catalogue now carries a `swarm` block
  (health, seeders) sampled from the tracker once an hour, and the Reciters view
  opens with a short «needs a seeder» strip — releases nobody is announcing,
  minus what this device already holds. `unknown` (never sampled, or a stale
  answer) is never rendered as "nobody seeds it".
- Version 0.2.3 in `package.json`, the lockfile and `version_name`.

**Packages, when approved:** `npm run build && npm run zip` (Edge + Chrome, same
file), `npm run build:firefox && npm run zip:firefox`. Chrome's listing still has
no ID in `apps/web/src/constants/companion.ts`, so nothing follows there yet.

**Open probe:** P5 (below) — whether the offscreen document exposes
`navigator.getBattery`.

## 0.2.2 — 2026-11-16

**Defaults that serve the product, a disk budget, and a settings page that
reads.**

- **Mixed is the default mode** for a fresh install: it holds what you listen
  to on tilawah.cc (newest first, oldest out at the cap) beside your own list.
  Manual remains one radio card away. Disclosure line added to the welcome
  screen. Upgrading installs whose settings never stored a mode also fall to
  mixed — the mode is visible at the top of Settings.
- **Defaults**: manual cap **3**, follow cap **2**, **disk limit 10 GB**.
- **Disk limit** (`maxDiskGb`, 0 = no limit): manual adds beyond the budget are
  refused with their own message; follow adds trim the oldest follow rows until
  the roster fits. Manual rows are never auto-deleted. The settings page shows
  a held-bytes meter against the budget.
- **Settings page restructured** into Holding / Space / Pausing / Sharing, with
  the three modes as radio cards (one line each) instead of a dropdown.
- Packages cut (manifest `0.2.2`, no dev key): `tilawah-companion-0.2.2-edge.zip`
  (same file as chrome), `tilawah-companion-0.2.2-chrome.zip`,
  `tilawah-companion-0.2.2-firefox.zip`; debug package
  `tilawah-companion-0.2.2-dev.zip` (keyed, id `opbhejfgfikjgnckojangiodobblkjfi`,
  staging-only target).

## 0.2.1 — 2026-11-16

**Listening modes** — the companion can follow what the person listens to.

- Three modes in settings: **Manual** (today's behaviour, the default), **Follow**
  (holds what the person plays on tilawah.cc, newest first, capped), and **Mixed**
  (the manual list untouched, plus a rotating follow list under its own cap).
- The site sends one fire-and-forget message when a reciter starts playing
  (`externally_connectable` matches tilawah.cc + staging). **No new permission.**
- Follow cap defaults to 2, 0 disables following; manual rows are never
  auto-evicted; a row playing right now is never evicted; the cap counts every
  follow entry and the trim walks around protected rows.
- The follow list is visible in the reciters view («تتابع ما تستمع إليه»), every
  row tagged «متابعة», each removable — removal deletes bytes immediately.
- **Reciter names are links** to their page on tilawah.cc (options lists and the popup); a
  slug-less or unpublished row stays plain text.
- **The About screen links to the live Edge listing** (`brand.ts` `edgeStore`).
- Privacy text discloses the playback channel (device-local, never forwarded).
- **Firefox limitation, said plainly:** Firefox does not let a web page send
  messages to an extension (`externally_connectable` is not implemented for
  pages — bugzilla 1319168), so the play notice never arrives there and
  Follow/Mixed hold nothing beyond what the person ticks by hand. Chromium
  (Chrome and Edge) is unaffected. The manifest key ships on both builds; if
  AMO's linter objects to the Chrome-only key at 0.2.1, strip it from the
  Firefox build. A content-script relay is out by design — the extension must
  not read pages.

## After approval — the only steps left

1. Send the two remaining listing URLs (Chrome, Firefox) when they clear. `src/constants/brand.ts`
   `edgeStore` is already filled; the other two keys stay empty until their listings exist.
2. Fill those keys, rebuild, and ship the follow-up patch.
3. Add the two links to the site's `/seed` page, alongside the greyed buttons, and to
   `apps/extension/README.md`.
4. Run `P1` (ten idle minutes in Firefox) on a real Firefox and record it in `docs/PROBES.md` — it
   was never run, and the AMO listing is live without it.

## Reminder

**When Chrome and Firefox are approved, send me the two URLs** — I will update `brand.ts`, the site's
`/seed` page and the READMEs, then cut the follow-up release. The Edge link is already in place.
