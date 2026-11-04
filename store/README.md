# Store screenshots

Arabic (`ar`) listing artwork for Tilawah, composed from the deployed app at
[tilawah.cc](https://tilawah.cc). These are **marketing composites**, not raw UI
captures: each slide puts a real screenshot inside a device frame with the
listing headline. The raw captures used by the install prompt live separately in
[`apps/web/public/screenshots`](../apps/web/public/screenshots).

All sets use the same four slides: **player**, **reciters**, **settings**,
**about**. The player slide shows real playback time and the app's own 28-bar
spectrum, sampled from its `AnalyserNode`; no state was mocked.

## Layout

| Folder | Store | Size | Slides |
| --- | --- | --- | --- |
| `app-store/ar-SA/iphone-6.9` | App Store | 1320 × 2868 | 4 |
| `app-store/ar-SA/iphone-6.3` | App Store | 1206 × 2622 | 4 |
| `app-store/ar-SA/ipad-13` | App Store | 2064 × 2752 | 4 |
| `google-play/ar/phone` | Google Play | 1080 × 1920 | 4 |
| `google-play/ar/tablet-10` | Google Play | 1440 × 2560 | 4 |
| `desktop/macbook-2880x1800` | Web / press | 2880 × 1800 | 4 |

The desktop set is not a store listing size; it is the large-screen artwork for
the website, release posts and press. `contact-sheet.png` shows every set at
once for review.

## Regenerating

The set is produced by [capture-flow](https://github.com/adelpro/capture-flow)
from the Sada template and checked-in captures of the deployed site:

```bash
npx tsx src/cli.ts build --manifest examples/open-tilawa/shots-minimal.json
npx tsx src/cli.ts build --manifest examples/open-tilawa/shots-desktop.json
npx tsx src/cli.ts verify --dir screenshots
```

The captures come from the deployed site, not a branch, so the store listing
never shows unreleased UI. Re-capture after a release that changes the player,
the reciter sheet or settings.
