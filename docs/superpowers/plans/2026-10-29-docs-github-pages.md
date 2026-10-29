# Docs on GitHub Pages — plan (2026-10-29)

Status: **not started**. Scope: publish the existing `docs/` tree as a rendered
site. No content rewrite, no second copy.

## Why

The console's Help page now links to
`github.com/adelpro/open-tilawa/tree/main/docs/how-it-works` (`Help.tsx`, `DOCS_URL`).
That works, but the reader lands in a file browser: relative links such as
`../INFRASTRUCTURE.md` leave the folder view, and there is no single entry page.
Pages gives the same files a URL, a table of contents and readable HTML for free.

## What ships

- **URL:** `https://adelpro.github.io/open-tilawa/` (a custom host, e.g.
  `docs.quran.us.kg`, is a later and separate decision).
- **Source:** `/docs` on `main`, published with GitHub Pages' *Deploy from a branch*
  — no Actions workflow, no build artifact, no Node step.
- **Landing:** a new `docs/index.md`.

## Steps

1. **`docs/index.md`** — three sentences on what Tilawa is, then a table of
   contents: *How it works*, *Infrastructure*, *Streaming*, *Accounts and sync*,
   *Releasing*. Link-dense; this page exists to route, not to explain.
2. **`docs/_config.yml`**
   ```yaml
   title: Tilawa
   description: Qur'an recitations distributed as torrents, played peer-to-peer.
   theme: jekyll-theme-primer
   exclude:
     - superpowers        # plans and audits stay in the repo, unpublished
     - how-it-works/render.mjs
     - how-it-works/diagrams.html
     - auth-and-rings/render.mjs
   ```
   Plans and reviews are working records, not documentation for a visitor; the
   `exclude` line is what keeps them off the site without moving a file.
3. **Check the folder-relative links.** Every cross-referenced document
   (`INFRASTRUCTURE.md`, `STREAMING.md`, `GUN_MULTI_DEVICE_SYNC.md`,
   `RELEASING.md`) already lives inside `docs/`, so `../INFRASTRUCTURE.md` from
   `how-it-works/` resolves to a published page. This is the one thing that would
   have forced a directory reshuffle, and it does not.
4. **Turn it on:** repo → Settings → Pages → *Deploy from a branch* → `main` / `/docs`.
5. **Point the console at it:** replace `DOCS_URL` in
   `apps/admin/apps/web/src/routes/Help.tsx` with the Pages URL. One constant, both
   locales, nothing else to touch.
6. **Verify:** every link on the rendered site returns 200, the eight PNGs render,
   `docs/superpowers/...` returns 404.

## Constraints

- **No second copy.** Pages publishes `docs/` as it stands. There is no transform,
  so there is nothing that can drift from the repo — the failure mode this plan
  exists to avoid.
- **Executable numbers become indexable.** `INFRASTRUCTURE.md` (ports, container
  names, volumes) is already public in the repo; Pages makes it crawlable. If that
  is not acceptable, the alternative is a `gh-pages` branch built from an allowlist
  instead of the raw folder. **Decide this before step 4**, because reverting a
  published page is slower than not publishing it.
- **English only.** The site is a developer/operator surface. The console keeps its
  bilingual in-app help; the docs link is additive there and must never become the
  Arabic reader's only path.
- **No theme work.** Primer's defaults are accepted as-is: `INFRASTRUCTURE.md`'s
  ASCII diagram and wide tables must be checked at 390px, not restyled.

## Acceptance

- [ ] `https://adelpro.github.io/open-tilawa/` renders the landing and links all
      eight `how-it-works` pages.
- [ ] `how-it-works/README.md`'s "if you only read two" links work from the site.
- [ ] `docs/superpowers/**` is 404 on the site.
- [ ] The console's Help panel opens the Pages URL in EN and AR.
- [ ] No file moved; `git log --follow` still shows one history per doc.

## Risks

- Pages caches for a few minutes after a push; a corrected page can lag.
- Jekyll's HTML pipeline can mangle `<` in prose — `INFRASTRUCTURE.md`'s diagram
  block is the first thing to inspect.
- Pages on a private repo needs a paid plan; the repo is public today, so this
  plan assumes it stays that way.
