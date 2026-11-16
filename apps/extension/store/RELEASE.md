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
