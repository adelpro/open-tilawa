# Tilawa roster, catalogue ownership, and the `/media` web seed

Date: 2026-10-27
Status: approved for planning
Repo: `open-tilawa` (branch `revert/minimal-player`)

## 1. Problem

The player's reciter list is wrong and the fallback is the wrong shape.

- The live list renders **23 rows from 20 catalogue rows**: `constants/reciters.ts`
  still carries hashes the catalogue does not know, and `mergeReciters` appends
  every static row whose hash is missing from the catalogue. That resurrects a
  stale Wadih hash (`e63e2267…`; the real row is `69331439…`) and shows Maher
  twice. A static label also survived a re-torrent: `5e0becf3…` still says
  "سعد الغامدي" in code while the catalogue and the audio say Maher.
- There is no rule for variants: Husary appears three times (Hafs, Warsh,
  Qalon), Abdulbasit twice (Warsh, Mojawwad), Maher twice (original, Update2).
- "HTTP fallback" meant a **parallel source**: a reciter without a magnet played
  from Itqan with `<audio src={itqanLink}>`. That path has no peers, no
  uploading, no analyser (Itqan's audio host sends no CORS), and no way back to
  P2P.
- The roster lives in code, so curating it needs a deploy, and the catalogue
  (the one place that knows what actually exists) has no say.

## 2. Goals

1. **Ten reciters, catalogue-owned.** One row per person, no duplicates, no
   hardcoded roster in the web app.
2. **HTTP is a fallback inside WebTorrent**, never an `<audio src>` swap: a BEP19
   web seed served from our own origin, so pieces are verified, stored, shared
   with peers, and peers are used in parallel the moment they appear.
3. **Two Itqan reciters seeded by us** — one Hafs, one Warsh, under 2.5 GB
   combined — so they play P2P like everyone else, with the same fallback.
4. **Riwaya is data, not a default.** `unknown` when nobody has said; the ten
   rows carry their value explicitly.

## 3. Non-goals

- No external CDN or Cloudflare Worker as a web seed (only `/media`).
- No per-reciter HTTP base URLs, no runtime use of mp3quran or Itqan URLs.
- No `sort_order` column; the public order is the catalogue `id` order.
- No multi-node media lookup: `/media` serves the primary node only (§8).
- No deletion of unpublished catalogue rows, and no admin control over `/media`.
- No resolution of Itqan's licensing question (see §11).

## 4. The roster (10)

Existing eight, all already 100% on the node:

| # | Reciter | Riwaya | Infohash | Size | Folder served from `/media` |
|---|---|---|---|---|---|
| 1 | ماهر المعيقلي | Hafs | `5e0becf3…aa396` | 1.24 GB | `Maher_Al-Muaiqly_(MP3_Quran)` |
| 2 | سعد الغامدي | Hafs | `ff77deab…7438a` | 440 MB | `Quran-MP3-Ghamdi` |
| 3 | عبد الباسط عبد الصمد (مجوّد) | Hafs | `331e7486…3a76d` | 526 MB | `Abdulbasit_Abdulsamad_Mojawwad_(MP3_Quran)` |
| 4 | مشاري راشد العفاسي | Hafs | `823ce833…76481` | 207 MB | `The Holy Quran MP3 recited by Mishary Rashid Al Afasy` |
| 5 | أبو بكر الشاطري | Hafs | `47db7a21…47a7ed` | 1.43 GB | `Shaik_Abu_Baker_Shatri_(MP3_Quran)` |
| 6 | ياسر الدوسري | Hafs | `f5fb5572…dd97f` | 1.43 GB | `Yasser_Aldosari_(Update2)_(MP3_Quran)` |
| 7 | عبد الرحمن السديس | Hafs | `eb11251f…6bfb9` | 1.17 GB | `AbdulRahman_Al-Sudais` |
| 8 | ياسين الجزائري (ورش) | Warsh | `012101c6…f4f30d` | 1.57 GB | `Yassine_El_Jazairi_Warsh` |

New two from Itqan (asset ids in `/recitations/:id/`):

| # | Reciter | Riwaya | Asset | Size | Folder |
|---|---|---|---|---|---|
| 9 | عاطف مفتاح | Hafs | `127` | 1.15 GiB | `Atef_Muftah_Hafs` |
| 10 | مفتاح السلطاني | Warsh | `159` | 1.04 GiB | `Moftah_ElSaltani_Warsh` |

Combined 2.19 GiB (2.36 GB decimal), under the 2.5 GB cap under either reading of
"GB". Both have 114 tracks in the default folder.

Deduped away (and therefore not published): `465aa4a5…` (second Maher),
`110eedff…` (Abdulbasit Warsh), `4dd0536b…` / `87c83e0b…` / `c4ac5dec…` (Husary
Hafs/Warsh/Qalon), `69331439…` (Wadih, also 99.9% on disk), plus Fares Abbad,
Khalid Al-Jaleel, Huzza Al-Baloushi, Kantaoui, Ahmed Alajmi, Minshawi.

## 5. Catalogue ownership

The catalogue is the only source of the roster.

**Schema (in-code, like `name_ar` and `size_bytes`)**

- `published INTEGER NOT NULL DEFAULT 1` on `reciters`.
- `riwaya` default changes to `'unknown'` in `CREATE TABLE` (fresh databases
  only; every write passes the value explicitly, so the live default is vestigial
  and needs no table rewrite).
- Vocabulary: `Hafs`, `Warsh`, `Qalon`, `unknown`.

**Service**

- `listPublished()` → `WHERE published = 1 ORDER BY id`.
- `list()` keeps every row for the console, now exposing `published`.
- `add()` / `update()` accept `published`.
- `importFrom()` writes `riwaya: 'unknown'` instead of `'Hafs'`.
- **Delete** `reciter-riwaya.ts` and `seedRiwaya()`: a hash→riwaya table in code is
  exactly the implicit default this design removes. The values already in the
  database are the source.

**Public endpoint** (`GET /api/public/reciters`)

Returns published rows only, and adds `id`. Payload per row:
`id`, `name`, `nameAr`, `riwaya`, `infohash`, `magnet`, `sizeBytes`, `fileCount`.
No normalisation of `riwaya` — whatever the row says is what the client gets.

**Admin console**

- `routes/Reciters.tsx`: `Reciter` gains `published: boolean`; the list shows a
  «منشور» / «مخفي» chip, and the edit dialog gets a published switch (the add
  form defaults to published).
- i18n keys (`ar.ts` / `en.ts`): `reciters.published`, `reciters.hidden`,
  `reciters.publishedHint`.

**Data step (one-off, on the live DB)**

```sql
UPDATE reciters SET published = 0;

UPDATE reciters SET published = 1
 WHERE lower(infohash) IN (
   '5e0becf35d91ea4602f04db90d74621a172aa396',
   'ff77deab793113dabf0a39d85fe6dbfdb107438a',
   '331e7486de1a8c634f4e1e5c78906e015187a76d',
   '823ce8332e2bd3d555b5c35fc12bab50a6976481',
   '47db7a2155fef5797c046105aaa6eb16be47a7ed',
   'f5fb5572e70163e72b1fb6add43da32da60dd97f',
   'eb11251ff351a202a72f2959fae7e3a4183a6fb9',
   '012101c66ee42d7c5905ab910e2b129335f4f30d'
 );

UPDATE reciters SET riwaya = 'Hafs'
 WHERE lower(infohash) IN (
   '5e0becf35d91ea4602f04db90d74621a172aa396',
   'ff77deab793113dabf0a39d85fe6dbfdb107438a',
   '331e7486de1a8c634f4e1e5c78906e015187a76d',
   '823ce8332e2bd3d555b5c35fc12bab50a6976481',
   '47db7a2155fef5797c046105aaa6eb16be47a7ed',
   'f5fb5572e70163e72b1fb6add43da32da60dd97f',
   'eb11251ff351a202a72f2959fae7e3a4183a6fb9'
 );

UPDATE reciters SET riwaya = 'Warsh'
 WHERE lower(infohash) = '012101c66ee42d7c5905ab910e2b129335f4f30d';
```

Every other row keeps `published = 0` and whatever riwaya it had; nothing is
deleted, so **Import from node** can re-add rows without republishing them.

## 6. Web data flow

Deleted files:

- `src/constants/reciters.ts`
- `src/constants/reciter-names.ts`
- `src/constants/itqan-badr-alturki.json`, `src/constants/itqan-majid-alzamil.json`
- `src/types/magnet-link-source.ts`
- `src/utils/reciter-merge.ts` (only `cleanTorrentName` survives, moved to
  `src/utils/reciter-name.ts`)
- `test/reciter-merge.test.ts`

Also:

- `src/constants/index.ts` stops re-exporting `./reciters`.
- `sheet.tsx`: the hardcoded `http` filter chip and the `HTTP` badge on rows are
  removed (`filter === 'http'` and `itqanPlaylist` no longer exist).
- `i18n/messages.ts`: `source.http`, `source.label`, `source.fromHost`,
  `stream.httpNote` and `sheets.http` are removed; `source.webseed` and
  `source.fromServer` are added (ar + en).

`Reciter` becomes:

```ts
export type Reciter = {
  id: number;      // catalogue row id
  name: string;    // nameAr, else cleanTorrentName(row.name)
  magnet: string;
  riwaya: string;  // 'Hafs' | 'Warsh' | 'Qalon' | 'unknown'
  complet: boolean; // fileCount >= 114
};
```

`use-reciters.ts` fetches once, maps rows, and:

- on success: replaces state and writes the payload to `localStorage` under
  `tilawa.reciters.v1`;
- on failure: uses that cached payload if present, otherwise exposes
  `error: true` and the page shows «تعذّر تحميل القرّاء» with a retry button —
  **never a built-in list**.

The page renders `reciters` as-is; order is the catalogue order. The riwaya
chips are built from the values actually present, so an all-`unknown` catalogue
shows only «الكل».

`riwayaLabel()`: `unknown` (and empty) → «غير محدّد». The `?? 'حفص'` fallbacks in
the sheet are removed.

`use-torrent.ts` loses its `!magnetURI` branch entirely: a published reciter
always has a magnet. `toReciters` filters out a row with an empty magnet (and
dedupes by infohash, keeping the lowest id), so the player is never handed a
reciter that cannot play.

`APP_VERSION` stops being the literal `'1.3.5'`: `constants/version.ts` reads
`version` from `apps/web/package.json` (`resolveJsonModule` is already on), so a
release bumps the package version only. The seeder reads its own `package.json`
at runtime for `X-Client-Version`.

## 7. The web-seed fallback

**Principle: the audio element's `src` never changes.** It always points at
`file.streamURL` (the service-worker URL). The fallback adds a *source to the
torrent*, not a second player.

- After `torrent.ready`, a timer starts. If `torrent.numPeers === 0` for 8
  continuous seconds and the torrent is not already complete, call
  `torrent.addWebSeed(new URL('/media/', window.location.origin).href)` **once**.
- The timer resets whenever a peer appears. It never removes the web seed
  afterwards: peers and the web seed are used concurrently from then on.
- Pieces from the web seed are verified against the torrent hashes, stored, and
  uploaded to peers like any other piece. When browser peers appear, WebTorrent
  requests from both; there is no mode switch and no seek.
- The web seed URL is absolute because `addWebSeed` rejects relative URLs.
- If `/media/<folder>/<file>` is missing, that request 404s; WebTorrent marks the
  piece missing and retries after ~10 s. Log once, do not surface an error while
  another source is working.
- The timer needs `torrent.ready`, which the `.torrent` file provides without any
  peer. If the metadata file is missing *and* no peer answers, the torrent never
  becomes ready and no web seed can be attached; that case keeps the existing
  timeout error.

Exposed state, added to `TorrentInfo`:

```ts
webSeed: 'off' | 'active';
```

Pure decision helper (testable, no timers inside):

```ts
// src/utils/webseed.ts
export function shouldAddWebSeed(input: {
  ready: boolean;
  peers: number;
  progress: number;
  waitedMs: number;
  alreadyAdded: boolean;
}): boolean;
```

`StreamSource` becomes `'connected' | 'waiting' | 'webseed'` (`'http'` is gone).
Footer icon: `wifi` for connected/waiting, `link` for webseed. The sheet shows the
live numbers plus two rows:

- «المصدر» = «الأقران» / «الخادم» / «بانتظار الأقران»;
- «البديل» = «متوفّر» / «غير متوفّر» / «جارٍ الفحص» for **this surah**, from one
  `HEAD <origin>/media/<torrent.name>/<NNN>.mp3` issued when the sheet opens
  (same origin, no CORS, no range). The answer is cached per
  `folder/surah` for the session and reused by the web-seed trigger, so the
  check never runs twice for the same file.

That last row is the only new probe: it turns "waiting for peers" from a dead end
into an answer, and it costs one request per surah the listener actually opens.

## 8. Serving `/media`

- `docker-compose.yml` → `web` service mounts the volume read-only:

  ```yaml
  - seed_downloads:/usr/share/nginx/html/media:ro
  ```

- `apps/web/nginx.conf` (the server-level `root /usr/share/nginx/html` already
  points at the mount, so no `alias` — mixing `alias` with `try_files` is the
  one nginx trap here):

  ```nginx
  # Torrent payload for the web seed. Range + MIME are nginx defaults; the
  # rate cap keeps one listener from saturating the line.
  location /media/ {
    try_files $uri =404;
    limit_rate 1m;
    add_header Cache-Control "public, max-age=3600";
  }
  ```

- `try_files … =404` matters: without it a missing file would fall through to the
  SPA and the web seed would receive HTML as audio data.
- The folder layout already matches what WebTorrent requests:
  `<webseed base>/<torrent name>/<file>`, e.g.
  `/media/Maher_Al-Muaiqly_(MP3_Quran)/002.mp3`. Spaces are percent-encoded by
  URL parsing; no folder names contain `%`, `?` or `#`.
- No authentication, no CORS (same origin), no headers. This is the only
  client-side mechanism that is both allowed by browsers and participates in
  seeding.

**Which node does `/media` serve?** The one mounted into the web container: the
seeder in the same compose stack, i.e. the node on the web/admin host. It is not
a lookup across the fleet. Today there is exactly one seeder
(`Home-server seeder`, `http://seeder:8085`), so there is no gap, and the
operational rule is: *a reciter is published only when the primary node holds
it* — which is also what "Import from node" guarantees.

When a second node appears, `/media` does not automatically reach it. The upgrade
path, in order of cost:

1. **Primary-only (today).** Keep publishing only what the web host holds.
2. **Per-node web seeds.** Each node serves its own `/media` with
   `Access-Control-Allow-Origin: *`; the client adds one web seed per known node
   origin. Pieces come from whichever node has them; the header is ours, so CORS
   is not an obstacle. Needs a node list (the seeders table already has one) and
   one nginx stanza per node.
3. **Proxy by infohash.** `/media/<infohash>/<file>` asks the catalogue which
   node holds the torrent and streams from it. One URL, more moving parts.

Out of scope here; recorded so the single-host assumption is explicit.

## 9. Itqan import

New `apps/seeder/import-itqan.mjs`, run inside the seeder image so it uses the
same volumes:

```
node import-itqan.mjs <assetId> <folderName> <riwaya>
```

Steps:

1. `GET https://api.cms.itqan.dev/recitations/<assetId>/?page_size=1000` with
   `X-API-Key: $ITQAN_API_KEY` (optional today, required soon),
   `X-Client-Name: open-tilawa`, and `X-Client-Version` read from
   `package.json` at runtime (never hardcoded).
2. Expect `count === results.length === 114`; the default page size is 20 and
   truncates silently. Refuse otherwise.
3. Sum `size_bytes` and call `fits()` from `lib/policy.mjs` **before**
   downloading, aborting with `507` when the node has no headroom.
4. Download each track's `audio_url` verbatim (it carries Itqan's per-app
   `?c=` code) to `${DOWNLOAD_PATH}/${folderName}/${NNN}.mp3` where `NNN` is the
   zero-padded `surah_number`. Concurrency 3, 3 attempts with backoff, skip a
   file whose existing size already matches, verify size after download.
5. `client.seed(folder, { name: folderName, pieceLength: 2097152 })`, write
   `<infoHash>.torrent` into `TORRENT_DIR`, and print one line:

   ```
   name=<folderName> files=114 size=<bytes> infohash=<hash> magnet=magnet:?xt=...
   ```

6. The running seeder only loads `.torrent` files at boot, so a restart is part
   of the procedure: `docker compose restart seeder`.
7. Add the catalogue row (console or `POST /reciters`) with `name`, `nameAr`,
   `riwaya`, `infohash`, `magnet`, `fileCount` and `sizeBytes`, `published = 1`.

`ITQAN_API_KEY` goes in `.env` (already gitignored) and `.env.example` gets the
empty key name. It never enters the web bundle; the browser never talks to Itqan
in this design.

## 10. Testing

Web (`node --experimental-strip-types --test`):

- `test/catalogue.test.ts` — `toReciters(rows)`: `nameAr` preferred over cleaned
  torrent name; `riwaya` passed through including `unknown`; `complet` from
  `fileCount`; `id` preserved; a row with an empty magnet is filtered out; two
  rows with the same infohash collapse to one (lowest id).
- `test/webseed.test.ts` — `shouldAddWebSeed`: fires at 8 s with 0 peers and
  incomplete progress; does not fire with a peer; never fires twice; does not
  fire on a complete torrent. `mediaUrl` builds
  `<origin>/media/<folder>/<NNN>.mp3` with the surah zero-padded and the folder
  encoded.
- `test/riwaya.test.ts` — `unknown`/empty → «غير محدّد», `Hafs`/`Warsh`/`Qalon`
  unchanged.
- Remove `test/reciter-merge.test.ts`.

Admin API (`apps/admin/apps/api`, existing jest harness):

- public endpoint returns published rows only and includes `id`;
- an unpublished row is absent;
- `riwaya: 'unknown'` round-trips unchanged;
- `PATCH /reciters/:id { published: false }` hides the row.

Seeder:

- `test/itqan.test.mjs` — pure helpers: track → `NNN.mp3`, sum of sizes,
  resume decision (same size → skip), folder-name validation.

Manual, after deploy:

1. The list is exactly ten, no duplicate person.
2. A reciter plays with the sheet showing «الأقران».
3. Block WebRTC / use a browser that cannot reach a peer: after ~8 s the sheet
   switches to «الخادم» and the same surah keeps playing without a seek.
4. `curl -I https://tilawa.quran.us.kg/media/Quran-MP3-Ghamdi/001.mp3` → 200,
   `audio/mpeg`, `Accept-Ranges: bytes`.
5. Both Itqan reciters appear, have peers, and play.

## 11. Risks and consequences

- **Catalogue outage** → the cached list or an error screen. A built-in list is
  deliberately gone.
- **Reciter ids change** (static ids → catalogue ids), so stored playback
  positions reset once.
- **`/media` uploads come from our own line**, capped at 1 MB/s per connection by
  nginx. It is a fallback, not a CDN.
- **Fallback is not independent of the node**: same box as the site, and `/media`
  reflects only the primary node's inventory. A published reciter that the
  primary does not hold simply has no fallback. A Worker proxy or per-node web
  seeds are the documented next steps if that ever matters.
- **Itqan licensing is unresolved**: the API exposes `publisher` but no licence
  field and the docs publish no terms, while this design redistributes the audio
  over BitTorrent. Attribution is shown for the reciter; a written answer from
  Itqan is still owed. Tracked in memory (`itqan-media-cors`), not blocking this
  work.
- **Unpublished rows still occupy ~22 GB** on the node. Curating the public list
  is not a storage policy; removal stays a separate, deliberate act.

## 12. Rollout order

1. Admin API (`published`, `id` in the public payload, `riwaya` default, delete
   `reciter-riwaya.ts`).
2. Admin web (publish toggle).
3. Data: unpublish all, publish the eight, set their riwaya.
4. Web deploy (catalogue-only roster, web-seed, nginx `/media` + volume mount).
5. Import Itqan `127` and `159`, restart the seeder, add both rows, publish.
6. Verify §10 manual checks. The release bumps `package.json`; `APP_VERSION`
   follows it automatically, so there is no second version string to edit.

Steps 1–3 must precede 4: the new client needs `id` from the API.
