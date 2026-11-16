# Release 0.2.0 — files and steps

## Files to upload

| Store | File | What it is |
| --- | --- | --- |
| Chrome Web Store | `tilawah-companion-0.2.0-chrome.zip` | the built MV3 extension, `npm run zip` |
| Firefox AMO | `tilawah-companion-0.2.0-firefox.zip` | the built MV2 extension, `npm run zip:firefox` |

Both are served from the build host beside this checkout; regenerate any time with:

```bash
cd apps/extension
npm run build && npm run zip            # Chrome
npm run build:firefox && npm run zip:firefox   # Firefox
```

## Steps, in order

1. **Firefox first.** AMO is free, review is human, and a signed build can be installed in release Firefox. Upload the zip at `addons.mozilla.org/developers/`, choose **On this site** (listed) only after P1 passes; for testing use **On your own** (unlisted).
2. **P1 gate.** Ten minutes with Firefox seeding, then read `tracker.tilawah.cc/stats`. Still recorded as NOT RUN in `docs/PROBES.md`. Do not publish on AMO before it passes.
3. **Chrome.** Upload the zip, category **Productivity**, visibility **Public**, fill the privacy practices form from `store/store-fields.md`, add the five screenshots.
4. **Source archive (AMO).** The bundle is minified, so AMO will ask for readable source: upload a zip of `apps/extension` (without `node_modules`, `.output`) plus a line saying `npm install && npm run build:firefox`.
5. **After approval — set the links.** `src/constants/brand.ts` has `chromeStore` and `firefoxAddons` deliberately empty; the About view renders a store link only when one exists. Fill both, rebuild, and cut `0.2.1`. The same day, add the two links to the site's `/seed` page and to `apps/extension/README.md`.

## Submission log

| Store | Package | Version | Submitted | Status |
| --- | --- | --- | --- | --- |
| Chrome Web Store | `tilawah-companion-0.2.0-chrome.zip` | 0.2.0 | 2026-11-16 | **in review** |
| Microsoft Edge Add-ons | `UPLOAD-THIS-tilawah-companion-0.2.0-edge.zip` | 0.2.0 | 2026-11-16 | **live** — https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom |
| Firefox AMO | `tilawah-companion-0.2.0-firefox.zip` | 0.2.0 | 2026-11-16 | **in review** |

Version 0.2.0 is locked for all three: the manifest version is `0.2.0` in every package, and none of
them can be replaced once accepted — a change after approval ships as 0.2.1.

Package rules learned the hard way:

- The file uploaded to a store is the one whose **zip root is `manifest.json`**. A wrapper zip that
  contains the package is rejected by Edge as "consists of a compressed file".
- AMO requires `browser_specific_settings.gecko.data_collection_permissions` (`{"required":["none"]}`)
  and rejects `import(<variable>)` as an unsafe dynamic import.
- The sources archive is the only separate upload, and it must match the submitted package exactly.

## Unreleased (0.2.1 — cut only when the human locks the version)

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

1. Send the three listing URLs. `src/constants/brand.ts` has `chromeStore` and `firefoxAddons`
   deliberately empty; the About view renders a store link only when one exists. Add an `edgeStore`
   key at the same time.
2. Cut **0.2.1**: fill those keys, rebuild, re-upload to all three stores.
3. Add the three links to the site's `/seed` page, alongside the greyed buttons, and to
   `apps/extension/README.md`.
4. Run `P1` (ten idle minutes in Firefox) on a real Firefox and record it in `docs/PROBES.md` — it
   was never run, and the AMO listing is live without it.

## Reminder

**When both listings are approved, send me the two URLs** — I will update `brand.ts`, the About view, the site's `/seed` page and the READMEs, then cut the follow-up release. Nothing in the extension points at a listing today, so there is no dead link to fix in a hurry.
