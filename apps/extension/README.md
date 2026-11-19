# Tilawah Companion

A browser extension that holds the Qur'an recitations you choose and seeds them to Tilawa listeners
over WebRTC — no account, no daemon, no tab left open.

- Spec: `docs/superpowers/specs/2026-11-15-tilawah-companion-design.md`
- Plan: `docs/superpowers/plans/2026-11-15-tilawah-companion.md` (both device-only, git-ignored)
- Probe results: `docs/PROBES.md`
- Store listing + checklist: `store/`

## Install

- Chrome — https://chromewebstore.google.com/detail/tilawah-companion/jfbadgomkkhmemefgckcadjfoldojekk
- Edge — https://microsoftedge.microsoft.com/addons/detail/tilawah-companion/nolphcjcahcbkkiohdkdmkkcdableoom
- Firefox — https://addons.mozilla.org/firefox/addon/tilawah-companion/

## How it works

One engine (`src/lib/engine.ts`) and two hosts. On Chrome MV3 the engine lives in an **offscreen
document** (`reasons: ['WEB_RTC']`), which has no lifetime limit; on Firefox MV2 it lives in the
**persistent background page**. Both read the same message contract (`src/lib/messages.ts`), so
nothing above the host layer knows which browser it is on.

The background owns the clock: every 30 minutes it asks the host what the machine allows (battery,
metered, schedule), pauses or resumes the engine, repaints the badge, and once a day diffs the public
catalogue — reporting new or re-imported reciters, never adding them.

Pure logic is tested without a browser: catalogue diff, storage plan, run limits, badge colour,
settings parsing, selection gates. `npm run probe` is the browser half.

## Commands

```bash
npm install
npm run dev            # Chrome, hot reload
npm run dev:firefox    # Firefox (MV2)
npm run build          # .output/chrome-mv3
npm run build:firefox  # .output/firefox-mv2
npm run audit          # manifest permission allow-list (fails the build)
npm test               # vitest
npm run probe          # real browser: download, persist after reload, tracker presence
npm run screenshots    # store screenshots into store/screenshots
```

Node 22 is required (`~/.nvm/versions/node/v22.23.4`). The probe runs headful under `xvfb-run`
because Chrome 137+ ignores `--load-extension`; Playwright's bundled Chromium does not.

## The three rules the code keeps

1. **The badge is a colour, never a number.** Text badges overflow at four characters and read like
   notification counts; the sentence lives in the tooltip.
2. **Nothing is deleted to make room.** Over the cap, the picker refuses and names what to remove.
3. **Nothing is downloaded that the person did not tick.** A new reciter is a notification.
