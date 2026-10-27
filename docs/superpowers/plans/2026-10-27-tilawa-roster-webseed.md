# Tilawa roster, catalogue ownership and `/media` web seed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the catalogue the only source of the ten published reciters, and turn the HTTP fallback into a WebTorrent web seed served from our own `/media`, with a per-surah availability line in the stream sheet.

**Architecture:** The admin catalogue gains a `published` flag and serves `id`; the web deletes every static roster and maps catalogue rows directly. The player keeps one `<audio>` on the service-worker stream; when a torrent has no peers for 8 s it adds `https://<origin>/media/` as a BEP19 web seed, which nginx serves from the seeder's downloads volume. Two Itqan recitations are imported into the seeder with an API key and identifying headers.

**Tech Stack:** React 19 + Vite + Jotai + WebTorrent 3.0.21, NestJS + better-sqlite3 (admin API), nginx, WebTorrent in Node (seeder).

**Spec:** `docs/superpowers/specs/2026-10-27-tilawa-roster-catalogue-webseed-design.md`

## Global Constraints

- Riwaya vocabulary is exactly `Hafs`, `Warsh`, `Qalon`, `unknown`; nothing in code normalises a missing value to `Hafs`.
- The only fallback origin is `new URL('/media/', location.origin)`; no mp3quran or Itqan URL is fetched by the browser.
- The `<audio>` element's `src` is only ever `file.streamURL` (or nothing); it never points at an HTTP media file.
- `APP_VERSION` and `X-Client-Version` read `package.json`; no second version literal.
- Riwaya values are data: the ten rows are set by SQL, not by a code table.
- Web tests run with `node --experimental-strip-types --import ./test/alias-register.mjs --test test/<file>.test.ts`; admin API tests with jest; seeder tests with `node --test test/*.test.mjs`.
- Conventional commits, one per task.

## Review Focus

- **Catalogue returns zero rows** (nothing published, empty database): the player must show "no reciters" and keep working, not crash on an undefined selection.
- **A row without a numeric `id`** (old API still deployed): ids key saved positions, so the client must be deployed only after the API; `toReciters` must drop a row whose id is not a number.
- **`/media` returns 404** (file missing, or the node has not downloaded it): the sheet must say «غير متوفّر», and the web seed must fail quietly and keep retrying without an error dialog.
- **Zero peers and no `.torrent` file**: the existing "could not fetch metadata" timeout must still be shown; no silent spinner.
- **Peers exist but WebRTC cannot reach them**: after ~8 s playback must continue from the web seed with the current position preserved, no reload.

---

### Task 1: Admin API — `published`, `id`, and no code-side riwaya

**Files:**
- Modify: `apps/admin/apps/api/src/reciters/reciters.service.ts`
- Modify: `apps/admin/apps/api/src/reciters/public-reciters.controller.ts`
- Modify: `apps/admin/apps/api/src/reciters/reciters.controller.ts`
- Modify: `apps/admin/apps/api/src/reciters/catalogue-push.service.ts:115`
- Delete: `apps/admin/apps/api/src/reciters/reciter-riwaya.ts`
- Test: `apps/admin/apps/api/test/reciters.spec.ts`

**Interfaces:**
- Produces: `RecitersService.list(): Reciter[]` (now with `published: boolean`),
  `RecitersService.listPublished(): Reciter[]`,
  `add(input: { …, published?: boolean })`, `update(id, { …, published?: boolean })`.
- Produces: `GET /api/public/reciters` → `{ reciters: [{ id, name, nameAr, riwaya, infohash, magnet, sizeBytes, fileCount }] }`, published rows only, in id order.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { bootHarness, type Harness } from './harness';
import { RecitersService } from '../src/reciters/reciters.service';

const HAFS = '5e0becf35d91ea4602f04db90d74621a172aa396';
const WARSH = '012101c66ee42d7c5905ab910e2b129335f4f30d';
const magnet = (hash: string) => `magnet:?xt=urn:btih:${hash}&dn=x`;

describe('public reciter catalogue', () => {
  let h: Harness;
  beforeAll(async () => { h = await bootHarness(); });
  afterAll(async () => { await h.close(); });

  it('returns published rows only, with id and riwaya untouched', async () => {
    const service = h.app.get(RecitersService);
    const shown = service.add({ name: 'Maher', nameAr: 'ماهر', riwaya: 'Hafs', infohash: HAFS, magnet: magnet(HAFS), fileCount: 114 });
    service.add({ name: 'Yassine', riwaya: 'Warsh', infohash: WARSH, magnet: magnet(WARSH), fileCount: 114, published: false });

    const res = await request(h.app.getHttpServer()).get('/api/public/reciters').expect(200);

    expect(res.body.reciters).toHaveLength(1);
    expect(res.body.reciters[0].id).toBe(shown.id);
    expect(res.body.reciters[0].riwaya).toBe('Hafs');
    expect(res.body.reciters[0].nameAr).toBe('ماهر');
  });

  it('keeps an unknown riwaya as unknown', async () => {
    const service = h.app.get(RecitersService);
    const row = service.add({ name: 'Unknown', riwaya: 'unknown', infohash: 'f'.repeat(40), magnet: magnet('f'.repeat(40)), fileCount: 114 });
    const res = await request(h.app.getHttpServer()).get('/api/public/reciters').expect(200);
    expect(res.body.reciters.find((r: { id: number }) => r.id === row.id).riwaya).toBe('unknown');
  });

  it('hides a row when published flips to false', async () => {
    const service = h.app.get(RecitersService);
    const row = service.add({ name: 'Temp', riwaya: 'Hafs', infohash: 'a'.repeat(40), magnet: magnet('a'.repeat(40)), fileCount: 114 });
    service.update(row.id, { published: false });
    const res = await request(h.app.getHttpServer()).get('/api/public/reciters').expect(200);
    expect(res.body.reciters.some((r: { id: number }) => r.id === row.id)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/admin/apps/api && yarn jest test/reciters.spec.ts --runInBand`
Expected: FAIL — `published` is not accepted / `listPublished` missing / payload has no `id`.

- [ ] **Step 3: Implement the schema and service**

In `reciters.service.ts`: add `published INTEGER NOT NULL DEFAULT 1` to `CREATE TABLE`, add `ALTER TABLE reciters ADD COLUMN published INTEGER` when the column is missing (same pattern as `name_ar`), expose `published: r.published !== 0` in the row mapper, add `listPublished()` with `WHERE published = 1 ORDER BY id`, accept `published?: boolean` in `add`/`update` (stored as `0`/`1`), change the DDL default of `riwaya` to `'unknown'`, and delete the `RECITER_RIWAYA` import, the `seedRiwaya()` method and its call.

- [ ] **Step 4: Implement the endpoints**

`public-reciters.controller.ts`: iterate `listPublished()` and add `id` to the payload.
`reciters.controller.ts`: add `published?: boolean` to the `@Post` and `@Patch` bodies.
`catalogue-push.service.ts`: `riwaya: 'unknown'`.
Delete `reciter-riwaya.ts`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/admin/apps/api && yarn jest test/reciters.spec.ts --runInBand`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/admin/apps/api/src/reciters apps/admin/apps/api/test/reciters.spec.ts
git commit -m "feat(admin): publish flag and id in the public reciter catalogue"
```

---

### Task 2: Admin console — publish toggle

**Files:**
- Modify: `apps/admin/apps/web/src/routes/Reciters.tsx`
- Modify: `apps/admin/apps/web/src/lib/i18n/ar.ts`, `apps/admin/apps/web/src/lib/i18n/en.ts`

**Interfaces:**
- Consumes: `published` from Task 1.
- Produces: the console can hide/show a row, and the change survives a reload.

- [ ] **Step 1: Add the field to the screen**

Add `published: boolean` to the local `Reciter` interface. In the row, render `<Chip>` with `t('reciters.hidden')` when `!reciter.published`. In the edit modal, add a checkbox bound to `editPublished` (mirroring the `nameAr` `Field`), sent in the PATCH body. The add form defaults `published: true`.

- [ ] **Step 2: Add the strings**

`ar.ts`: `reciters.published: 'منشور'`, `reciters.hidden: 'مخفي'`, `reciters.publishedHint: 'يظهر في قائمة القرّاء على الموقع'`.
`en.ts`: the same keys in English.

- [ ] **Step 3: Verify**

Run: `cd apps/admin && yarn workspace @tilawa-admin/web build` (or the package's typecheck script)
Expected: builds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/apps/web
git commit -m "feat(admin-web): publish toggle for catalogue reciters"
```

---

### Task 3: Web — catalogue mapping

**Files:**
- Create: `apps/web/src/utils/reciter-name.ts` (moved `cleanTorrentName`)
- Create: `apps/web/src/utils/catalogue.ts`
- Test: `apps/web/test/catalogue.test.ts`

**Interfaces:**
- Produces: `CatalogueRow = { id: number; name: string; nameAr: string | null; riwaya: string; infohash: string; magnet: string; fileCount: number | null }`
- Produces: `toReciters(rows: CatalogueRow[]): Reciter[]`
- Produces: `cleanTorrentName(raw: string): string`

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toReciters } from '../src/utils/catalogue.ts';

const row = (over: Record<string, unknown> = {}) => ({
  id: 1, name: 'Maher_Al-Muaiqly_(MP3_Quran)', nameAr: 'ماهر المعيقلي', riwaya: 'Hafs',
  infohash: '5e0becf35d91ea4602f04db90d74621a172aa396',
  magnet: 'magnet:?xt=urn:btih:5e0becf35d91ea4602f04db90d74621a172aa396&dn=x',
  fileCount: 114, ...over,
});

test('the Arabic name wins over the cleaned torrent name', () => {
  assert.equal(toReciters([row()])[0].name, 'ماهر المعيقلي');
  assert.equal(toReciters([row({ nameAr: null, name: 'Quran-MP3-Ghamdi' })])[0].name, 'Quran MP3 Ghamdi');
});

test('riwaya is whatever the row says, including unknown', () => {
  assert.equal(toReciters([row({ riwaya: 'unknown' })])[0].riwaya, 'unknown');
  assert.equal(toReciters([row({ riwaya: '' })])[0].riwaya, 'unknown');
});

test('complet follows the file count', () => {
  assert.equal(toReciters([row({ fileCount: 114 })])[0].complet, true);
  assert.equal(toReciters([row({ fileCount: 80 })])[0].complet, false);
});

test('rows without a magnet or a numeric id are dropped', () => {
  assert.equal(toReciters([row({ magnet: '' })]).length, 0);
  assert.equal(toReciters([row({ id: undefined })]).length, 0);
});

test('duplicate infohashes collapse to the first row', () => {
  const list = toReciters([row({ id: 7 }), row({ id: 9, nameAr: 'مكرر' })]);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 7);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && yarn test`
Expected: FAIL — `Cannot find module '../src/utils/catalogue.ts'`.

- [ ] **Step 3: Implement**

Move `cleanTorrentName` to `src/utils/reciter-name.ts` unchanged. In `src/utils/catalogue.ts`, implement `toReciters` as: keep rows with a numeric `id` and a non-empty `magnet`; dedupe on lowercased `infohash` keeping the first; name = `nameAr?.trim() || cleanTorrentName(name)`; `riwaya = row.riwaya?.trim() || 'unknown'`; `complet = (fileCount ?? 0) >= 114`.

The `Reciter` shape comes from Task 4; write it there first if the import does not resolve.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && yarn test`
Expected: PASS for `catalogue.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils apps/web/test/catalogue.test.ts
git commit -m "feat(web): map the catalogue payload into players"
```

---

### Task 4: Web — one reciter shape, no static roster

**Files:**
- Modify: `apps/web/src/types/reciter.ts`
- Delete: `apps/web/src/types/magnet-link-source.ts`
- Modify: `apps/web/src/types/index.ts`
- Modify: `apps/web/src/types/track-type.ts`
- Delete: `apps/web/src/constants/reciters.ts`, `apps/web/src/constants/reciter-names.ts`, `apps/web/src/constants/itqan-badr-alturki.json`, `apps/web/src/constants/itqan-majid-alzamil.json`
- Modify: `apps/web/src/constants/index.ts`
- Delete: `apps/web/src/utils/reciter-merge.ts`, `apps/web/test/reciter-merge.test.ts`

**Interfaces:**
- Produces: `Reciter = { id: number; name: string; magnet: string; riwaya: string; complet: boolean }`
- Produces: `TrackType = { surahId: number; file?: any }`
- Produces: `TorrentInfo` gains `name: string`.

- [ ] **Step 1: Rewrite the types**

`reciter.ts` → the five fields above, with a comment that `id` is the catalogue row id (persistence key). `track-type.ts` → drop `link`, `webSeeds`, `error`. `torrent-info.ts` → add `name: string`. `types/index.ts` → drop the magnet-link-source export.

- [ ] **Step 2: Delete the static roster and its merge**

Remove the four files and the test listed above; delete `export * from './reciters'` from `constants/index.ts`. `cleanTorrentName` already moved in Task 3.

- [ ] **Step 3: Fix whatever still imports them**

Run: `cd apps/web && yarn type-check`
Expected: errors pointing at `sheet.tsx`, `use-torrent.ts`, `use-reciters.ts`, `audio-engine.tsx`. They are handled in Tasks 5, 8 and 9; leave the tree uncompilable only until those tasks land, and do not commit a broken build — commit this task together with Task 5 if needed.

- [ ] **Step 4: Commit (with Task 5 if the build is still red)**

```bash
git add apps/web/src/types apps/web/src/constants apps/web/test
git commit -m "refactor(web): one reciter shape, no static roster"
```

---

### Task 5: Web — `use-reciters` from the catalogue, with a cache and an error state

**Files:**
- Modify: `apps/web/src/hooks/use-reciters.ts`
- Modify: `apps/web/src/components/sheet.tsx` (ReciterSheet error state)
- Modify: `apps/web/src/app/player-page.tsx` (pass the props)

**Interfaces:**
- Produces: `useReciters(): { reciters: Reciter[]; error: boolean; retry: () => void }`
- Produces: `<ReciterSheet … error={boolean} onRetry={() => void} />`
- Cache key: `tilawa.reciters.v1` holding `{ reciters: CatalogueRow[] }`.

- [ ] **Step 1: Implement the hook**

Fetch `${ADMIN_API}/api/public/reciters` once per mount cycle (module-level in-flight promise, as today). On success: `toReciters(body.reciters)`, store the raw payload in `localStorage`. On failure: read the cache; if absent, `error: true`. `retry()` clears the in-flight promise and refetches. No import of a static list.

- [ ] **Step 2: Show the failure where reciters are chosen**

`ReciterSheet` gains `error`/`onRetry`; when `error && rows.length === 0`, render «تعذّر تحميل القرّاء» and a retry button instead of `Empty`.

- [ ] **Step 3: Verify**

Run: `cd apps/web && yarn type-check && yarn test`
Expected: type-check clean, tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/hooks/use-reciters.ts apps/web/src/components/sheet.tsx apps/web/src/app/player-page.tsx
git commit -m "feat(web): read the roster from the catalogue with a last-good cache"
```

---

### Task 6: Web — unknown riwaya

**Files:**
- Modify: `apps/web/src/utils/riwaya.ts`
- Test: `apps/web/test/riwaya.test.ts`

**Interfaces:**
- Produces: `riwayaLabel('unknown' | '' | undefined) === 'غير محدّد'`.

- [ ] **Step 1: Update the test**

```ts
assert.equal(riwayaLabel('unknown'), 'غير محدّد');
assert.equal(riwayaLabel(undefined), 'غير محدّد');
assert.equal(riwayaLabel(''), 'غير محدّد');
assert.equal(riwayaLabel('Shubah'), 'Shubah');
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && yarn test`
Expected: FAIL — `riwayaLabel(undefined)` is `'حفص'`.

- [ ] **Step 3: Implement**

Add `unknown: 'غير محدّد'` to `NAMES`; make the final fallback `'غير محدّد'` for empty/absent. Remove the `?? 'حفص'` in `sheet.tsx` (row badge and filter default).

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/riwaya.ts apps/web/src/components/sheet.tsx apps/web/test/riwaya.test.ts
git commit -m "feat(web): say unknown instead of assuming Hafs"
```

---

### Task 7: Web — web-seed helpers

**Files:**
- Create: `apps/web/src/utils/webseed.ts`
- Test: `apps/web/test/webseed.test.ts`

**Interfaces:**
- Produces: `WEBSEED_GRACE_MS = 8000`
- Produces: `shouldAddWebSeed(input: { ready: boolean; peers: number; progress: number; waitedMs: number; alreadyAdded: boolean }): boolean`
- Produces: `mediaBase(origin: string): string` → `${origin}/media/`
- Produces: `mediaUrl(origin: string, folder: string, surahId: number): string`
- Produces: `probeMedia(origin: string, folder: string, surahId: number): Promise<boolean>` (HEAD, cached per `folder/surah` for the module lifetime)

- [ ] **Step 1: Write the failing test**

```ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mediaBase, mediaUrl, shouldAddWebSeed } from '../src/utils/webseed.ts';

test('the web seed waits out the grace period with no peers', () => {
  const base = { ready: true, peers: 0, progress: 0, waitedMs: 8000, alreadyAdded: false };
  assert.equal(shouldAddWebSeed(base), true);
  assert.equal(shouldAddWebSeed({ ...base, waitedMs: 7999 }), false);
  assert.equal(shouldAddWebSeed({ ...base, peers: 1 }), false);
  assert.equal(shouldAddWebSeed({ ...base, ready: false }), false);
  assert.equal(shouldAddWebSeed({ ...base, progress: 1 }), false);
  assert.equal(shouldAddWebSeed({ ...base, alreadyAdded: true }), false);
});

test('media URLs match the torrent layout', () => {
  assert.equal(mediaBase('https://tilawa.quran.us.kg'), 'https://tilawa.quran.us.kg/media/');
  assert.equal(
    mediaUrl('https://tilawa.quran.us.kg', 'Quran-MP3-Ghamdi', 2),
    'https://tilawa.quran.us.kg/media/Quran-MP3-Ghamdi/002.mp3',
  );
  assert.equal(
    mediaUrl('https://tilawa.quran.us.kg', 'The Holy Quran MP3 recited by Mishary Rashid Al Afasy', 114),
    'https://tilawa.quran.us.kg/media/The%20Holy%20Quran%20MP3%20recited%20by%20Mishary%20Rashid%20Al%20Afasy/114.mp3',
  );
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/web && yarn test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`shouldAddWebSeed`: `ready && peers === 0 && progress < 1 && waitedMs >= WEBSEED_GRACE_MS && !alreadyAdded`. `mediaUrl`: `encodeURIComponent(folder)` and `String(surahId).padStart(3, '0')`. `probeMedia`: `fetch(url, { method: 'HEAD' })`, `res.ok`, memoised in a `Map<string, Promise<boolean>>` so a repeat open does not re-probe.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/web && yarn test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/utils/webseed.ts apps/web/test/webseed.test.ts
git commit -m "feat(web): add web-seed timing and /media URL helpers"
```

---

### Task 8: Web — the torrent adds a web seed, and loses the magnetless branch

**Files:**
- Modify: `apps/web/src/hooks/use-torrent.ts`
- Modify: `apps/web/src/components/audio-engine.tsx` (only the `link` removal)

**Interfaces:**
- Consumes: `shouldAddWebSeed`, `mediaBase` (Task 7).
- Produces: `TorrentInfo.webSeed: 'off' | 'active'` and `TorrentInfo.name`.
- Produces: no branch for a reciter without a magnet.

- [ ] **Step 1: Remove the HTTP-only path**

Delete the `if (!magnetURI) { … itqanPlaylist … }` block and the `itqanPlaylist` dependency. A missing magnet now leaves `torrentInfo` undefined and shows the existing error state.

- [ ] **Step 2: Add the timer**

After the torrent is ready, record `readyAt = Date.now()`. While not added, on every `download`/`wire` event and on a 1 s interval, call `shouldAddWebSeed({ ready: torrent.ready, peers: torrent.numPeers, progress: torrent.progress, waitedMs: Date.now() - readyAt, alreadyAdded })`; when true, `torrent.addWebSeed(mediaBase(window.location.origin))`, set `added = true`, and include `webSeed: 'active'` in the `setTorrentInfo` payloads. Emit `name: torrent.name` in `showPlaylist`.

- [ ] **Step 3: Drop `track.link`**

`audio-engine.tsx`: delete `const link = …`, the `else if (current.link)` branch, and `link` from the effect deps. Tracks are built with `{ surahId, file }` only.

- [ ] **Step 4: Verify**

Run: `cd apps/web && yarn type-check && yarn test`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/use-torrent.ts apps/web/src/components/audio-engine.tsx
git commit -m "feat(web): fall back to the /media web seed inside WebTorrent"
```

---

### Task 9: Web — the sheet tells the truth about this surah

**Files:**
- Modify: `apps/web/src/components/stream-sheet.tsx`
- Modify: `apps/web/src/components/player-footer.tsx`
- Modify: `apps/web/src/app/player-page.tsx`
- Modify: `apps/web/src/i18n/messages.ts`
- Modify: `apps/web/src/components/sheet.tsx` (remove the HTTP chip)

**Interfaces:**
- Consumes: `TorrentInfo.webSeed`, `TorrentInfo.name`; `probeMedia` (Task 7).
- Produces: `StreamSource = 'connected' | 'waiting' | 'webseed'`.
- Produces: `<StreamSheet … surahId={number} />` with a «البديل» row.

- [ ] **Step 1: Source derivation**

`player-page.tsx`: `const source = torrent?.webSeed === 'active' ? 'webseed' : (torrent?.peers ?? 0) > 0 ? 'connected' : 'waiting'`.

- [ ] **Step 2: The sheet**

Rows «الأقران · التقدّم · الملفات» stay. Add «المصدر» with the three labels, and «البديل» resolved by `probeMedia(origin, torrent.name, surahId)` on open: `'unknown'` → «جارٍ الفحص», `true` → «متوفّر», `false` → «غير متوفّر». Remove the `http` branch and `rowsFor`'s `source === 'http'` early return.

- [ ] **Step 3: Footer**

Labels: `connected` → `source.connected`, `waiting` → `source.waiting`, `webseed` → `source.webseed`; icon `link` for `webseed`, `wifi` otherwise; ring only for `waiting`/`webseed` (`stream-ring.ts`).

- [ ] **Step 4: Strings**

Remove `source.http`, `source.label`, `source.fromHost`, `stream.httpNote`, `sheets.http`. Add `source.webseed` («من الخادم»), `source.fromServer` («من خادم البثّ»), `stream.source` («المصدر»), `stream.fallback` («البديل»), `stream.fallbackAvailable` («متوفّر»), `stream.fallbackMissing` («غير متوفّر»), `stream.fallbackChecking` («جارٍ الفحص»). Mirror in English.

- [ ] **Step 5: Verify**

Run: `cd apps/web && yarn type-check && yarn lint && yarn test`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(web): show the live source and this surah's fallback in the stream sheet"
```

---

### Task 10: Web — version from `package.json`

**Files:**
- Modify: `apps/web/src/constants/version.ts`

**Interfaces:**
- Produces: `APP_VERSION` equal to `apps/web/package.json` `version`.

- [ ] **Step 1: Implement**

```ts
import pkg from '../../package.json';
export const APP_VERSION: string = pkg.version;
```

- [ ] **Step 2: Verify**

Run: `cd apps/web && yarn type-check && yarn build`
Expected: build succeeds and the top bar shows `1.3.5`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/constants/version.ts
git commit -m "refactor(web): read APP_VERSION from package.json"
```

---

### Task 11: Serve `/media`

**Files:**
- Modify: `docker-compose.yml` (web service volumes)
- Modify: `apps/web/nginx.conf`

**Interfaces:**
- Produces: `GET /media/<folder>/<NNN>.mp3` → the file from `seed_downloads`, 206 for ranges, 404 when missing, never the SPA shell.

- [ ] **Step 1: Mount the volume**

```yaml
    volumes:
      - seed_torrents:/usr/share/nginx/html/torrents:ro
      - seed_downloads:/usr/share/nginx/html/media:ro
```

- [ ] **Step 2: Add the location**

```nginx
  # Torrent payload for the web seed. Range + MIME are nginx defaults; the
  # rate cap keeps one listener from saturating the line.
  location /media/ {
    try_files $uri =404;
    limit_rate 1m;
    add_header Cache-Control "public, max-age=3600";
  }
```

No `alias`: the server-level `root /usr/share/nginx/html` already resolves `/media/…` to the mount, and `alias` + `try_files` is the trap this avoids.

- [ ] **Step 3: Verify locally after the next image build**

Run: `curl -sI http://127.0.0.1:<web-port>/media/Quran-MP3-Ghamdi/001.mp3 | head -5`
Expected: `200`, `Content-Type: audio/mpeg`, `Accept-Ranges: bytes`; a made-up file returns `404`.

---

### Task 12: Seeder — import an Itqan recitation

**Files:**
- Create: `apps/seeder/lib/itqan.mjs`
- Create: `apps/seeder/import-itqan.mjs`
- Test: `apps/seeder/test/itqan.test.mjs`
- Modify: `.env.example`

**Interfaces:**
- Produces: `trackFileName(surahNumber: number): string` → `'001.mp3'`
- Produces: `totalBytes(tracks: { size_bytes: number }[]): number`
- Produces: `shouldSkip(existingBytes: number | null, expectedBytes: number): boolean`
- Produces: `validFolderName(name: string): boolean` → `/^[A-Za-z0-9][A-Za-z0-9_-]*$/`
- Produces: `node import-itqan.mjs <assetId> <folderName> <riwaya>` printing one `name=… files=… size=… infohash=… magnet=…` line.

- [ ] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shouldSkip, totalBytes, trackFileName, validFolderName } from '../lib/itqan.mjs';

test('track file names are the three-digit surah', () => {
  assert.equal(trackFileName(1), '001.mp3');
  assert.equal(trackFileName(114), '114.mp3');
});

test('the total is the sum of the declared sizes', () => {
  assert.equal(totalBytes([{ size_bytes: 10 }, { size_bytes: 32 }]), 42);
});

test('a file is skipped only when its size matches', () => {
  assert.equal(shouldSkip(10, 10), true);
  assert.equal(shouldSkip(9, 10), false);
  assert.equal(shouldSkip(null, 10), false);
});

test('folder names stay filesystem- and URL-safe', () => {
  assert.equal(validFolderName('Atef_Muftah_Hafs'), true);
  assert.equal(validFolderName('Atef Muftah'), false);
  assert.equal(validFolderName('../etc'), false);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `cd apps/seeder && yarn test`
Expected: FAIL — cannot find `../lib/itqan.mjs`.

- [ ] **Step 3: Implement the helpers and the script**

Helpers as specified. The script: validate the folder name; `GET /recitations/<id>/?page_size=1000` with `X-API-Key` (when `ITQAN_API_KEY` is set), `X-Client-Name: open-tilawa`, `X-Client-Version` from `package.json`; require `count === results.length === 114`; `fits()` quota check with the summed bytes; download to `${DOWNLOAD_PATH}/${folderName}/` with concurrency 3, three attempts, skipping matching sizes; verify; `client.seed(folder, { name: folderName, pieceLength: 2097152 })`; write `${TORRENT_DIR}/${infoHash}.torrent`; print the summary line; destroy the client and exit.

- [ ] **Step 4: Add the key name**

`.env.example`: `ITQAN_API_KEY=` with a one-line comment that it is server-side only.

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/seeder && yarn test`
Expected: PASS (existing policy tests + 4 new).

- [ ] **Step 6: Commit**

```bash
git add apps/seeder .env.example
git commit -m "feat(seeder): import an Itqan recitation and seed it"
```

---

### Task 13: Data, deploy and the two imports

**Files:** none (operations), plus `docs/` notes if something surprises.

- [ ] **Step 1: Admin API + console deploy, then the data step**

Run the SQL from spec §5 inside the admin container after the API restart:
`UPDATE reciters SET published = 0;` then publish the eight hashes and set the seven `Hafs` + one `Warsh`.
Verify: `curl -s https://admin-tilawa.quran.us.kg/api/public/reciters | jq '.reciters | length'` → `8`.

- [ ] **Step 2: Web deploy**

Build the image, `docker compose up -d web`, verify §10 manual checks 1–4 with eight rows.

- [ ] **Step 3: Import the two Itqan recitations**

```
docker compose run --rm seeder node import-itqan.mjs 127 Atef_Muftah_Hafs Hafs
docker compose run --rm seeder node import-itqan.mjs 159 Moftah_ElSaltani_Warsh Warsh
docker compose restart seeder
```

- [ ] **Step 4: Publish them**

Add both rows through the console (or `POST /reciters`) with the printed infohash/magnet, `fileCount: 114`, `sizeBytes`, `published: true`, `riwaya` set.

- [ ] **Step 5: Final verification**

`/api/public/reciters` returns 10; both new reciters show peers; a reciter with peers blocked falls back to «الخادم» within ~8 s and the sheet says «البديل: متوفّر».

---

## Self-Review Notes

- Spec §4 roster → Tasks 3–5 (source), 12–13 (the two imports and their rows).
- Spec §5 catalogue → Tasks 1–2, 13.
- Spec §6 web data flow → Tasks 3–6, 10.
- Spec §7 fallback → Tasks 7–9.
- Spec §8 `/media` → Task 11, plus the multi-node paragraph which is explicitly out of scope.
- Spec §9 import → Task 12.
- Spec §10 tests → inline in Tasks 1, 3, 6, 7, 12; manual checks in Task 13.
- Spec §11 risks → Review Focus covers the four that can bite a user; the licensing item needs no code.
- Names checked across tasks: `toReciters`, `shouldAddWebSeed`, `mediaBase`, `mediaUrl`, `probeMedia`, `listPublished`, `webSeed`, `name` are used consistently.
