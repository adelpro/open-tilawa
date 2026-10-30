# فيلم تلاوة — 32 s cut (option b)

`final-32.mp4` · 1920×1080 · 30 fps · 32.0 s · 960 frames · H.264 + AAC (−16 LUFS, −1.5 dBTP)
Source: `film/index32.html` (plain HTML + `window.__seek(t)`). Spectrum: `peaks` — the app's second option, bars + caps.

---

## 1. What the long cut adds

The 21 s film is one idea: *the page draws the voice, then gets out of the way*. The 32 s cut keeps that spine and opens three more layers of the **same page** — the archive, the ring, the source — with one rule that keeps it from becoming a feature tour: **the recitation never stops.** Not one frame of silence is inserted for the UI beats; the panels are what you do *while listening*. The only cuts are the camera's.

| t | shot | what happens | why it holds |
|---|---|---|---|
| 0.0–7.2 | the page | pulls back to 1.16, the first voice draws itself, the first pause at 3.34, then the camera turns and pushes | the hook and the product in one take |
| 7.2–10.0 | القرّاء | the roster docks (the column slides 180 px), the camera dives to 3.2×, the arrow picks الحصري at 9.08 | one click, one consequence: V2 starts at 10.00 |
| 10.0–13.8 | the second voice | push 1.00 → 4.20, the spectrum at full width | the new voice's own shape |
| 13.8–17.4 | السور | cut; the mushaf docks; push to 2.80 on rows 1–4: الفاتحة 7 آيات · 804 KB, البقرة 286 آية · 119 MB | **the archive**: 114 rows with real verse counts and real torrent sizes |
| 17.4–21.4 | الحساب | cut; the panel docks; push to 2.80; «البيت» is typed into the field, the caret running | **the ring**: «مفتاح يُولَّد هنا … لا اسم مستخدم ولا كلمة مرور» |
| 21.4–26.2 | تفاصيل البث | cut; the panel docks; push to 2.80; **بانتظار الأقران** with the wifi arcs answering, 0 peers, البديل متوفّر — then at **23.90 a peer answers**: P2P, 1 peer, 853 KB/s | **the source**: the P2P claim in the product's own numbers |
| 26.2–29.4 | the page | cut back to 1.2; the bars, the recitation | the room again |
| 29.4–32.0 | the close | cut to 2.6; **تلاوة** lands at 30.50 at 1.20×, settles, holds with the bars alive | the name |

Six cuts, seven shots. 0–10.0 s is unchanged from the 21 s film (frame for frame), so the two versions share their opening.

## 2. What is real

- Both recitations: المنشاوي 2.00–12.00 s (film 0–10), الحصري 10.00–32.00 s (film 10–32), loudness-matched, joined where the first voice pauses.
- The spectrum: the `peaks` chain (AnalyserNode + `downsample` + `drawPeaks`), 960 frames from the real audio (`src/peaks-32.js`).
- Every string; the type; the tokens; the wordmark; the geometry (title 237.6/56 px, ribbon 520×160 at (700,683), roster/surah panels 360 px docked right, rows 64 px, the 180 px column shift).
- The roster's names, riwayat and counts; the surah list's verse counts, juz and file sizes; the stream numbers from a real 1-peer session (853 KB/s).
- The wifi glyph's animation: `.wifi-arc` 1.5 s, the middle arc delayed 0.5 s, the dot peaking at 40 % — computed per frame from `t`, not a CSS animation, so it is frame-exact in the render.

**Built (declared):** the page is a rebuilt DOM fragment; the typed name «البيت» is illustrative content (not a real ring); the peer "arriving" at 23.90 is a compressed 8-second real-world wait; the paper grain and the ticks are added; the arrow is designed.

## 3. Gates

*(filled from `look.py` / `lint.mjs` after the render — see the reply)*

## 4. What I would change next

- **The first 3 s are still the stillest** (`static-ish 1.67–4.73 s`): the pull-back plus the pause. A slow push inside the hook would give it a heartbeat without making it busy.
- **Cut sync is 1 of 7** within ±80 ms of a sound onset. That is deliberate — the voice runs across the cuts — but a viewer who reads cuts as musical hits will feel the panels arrive off-beat. Moving the three panel cuts onto onsets (13.72, 21.28, 26.42) is a one-line change if you want it.
- **The account beat is the quietest** of the three: 4 s on one card with a typed name. If it needs more, the join card (scan / enter code) is already built and one camera move away.
- **The panel pushes were re-timed** after the first render: at 2.2–3.4× per second the 180° shutter turned the rows into ghost strokes. All three now run 1.00 → 2.80 over ~1.9 s (≈0.95×/s), which keeps the text sharp and still lands on a readable hold.
