# Tilawah Companion — checklist

Everything that has to be true before a listing is submitted. Tick in order; the
first unticked line is the work.

## Accounts and money

- [ ] AMO account holds the `Tilawah Companion` name (Firefox first: free, automatic signing, and a
      signed `.xpi` can be side-loaded to test).
- [ ] Chrome Web Store developer account, and the one-off $5 fee paid.
- [ ] A confirmed decision on **who holds the accounts** (the spec leaves this to the person; it is
      the only external dependency left).

## Build and proof

- [ ] `npm run build && npm run build:firefox && npm run audit` — permission audit clean.
- [ ] `npm test` — 46 tests green.
- [ ] `npm run probe` — P2/P3/P4 recorded in `docs/PROBES.md` with a date.
- [ ] **P1 (Firefox idle) run on a real Firefox** and recorded. Open since 2026-11-15: no Firefox
      on the build machine. AMO went live on 2026-11-19 without it, so this is now a reliability
      check rather than a submission gate.

## Store paperwork

- [ ] Privacy and terms live at `https://adelpro.us.kg/open-tilawa/privacy.html` and
      `/terms.html` (GitHub Pages, workflow `extension-pages.yml`), and both load without JavaScript.
- [ ] Listing text from `listing-en.md`, Arabic from `listing-ar.md` (reviewed by uslub).
- [ ] Screenshots: `npm run screenshots` produces 1280×800 PNGs for the picker and the cap refusal.
      The **popup** still needs a framed 1280×800 composition — a 400 px popup screenshot does not
      meet the stores' minimum, and a crop of it would be dishonest about scale.
- [ ] Version bumped (`package.json`), and the same version in both store dashboards.

## After approval

- [ ] Tag the release, and add the listing URLs to the site's `/seed` page copy in a follow-up.
- [ ] Watch `tracker.tilawah.cc/stats` for a week: a store listing shows up there as WebTorrent
      clients, not as downloads.
