# فيلم تلاوة — NOTE (delivery)

`final-21-waves.mp4` / `final-21-bars.mp4` (was `final.mp4`) · 1920×1080 · 30 fps · 21.0 s · H.264 + AAC · sound = the recitation.
Editable source: `film/index.html` (plain HTML + `window.__seek(t)`, no build step).
Audio bed: `film/audio/mix.wav` (−16 LUFS integrated, −1.5 dBTP).

---

## 0. Amendment (after the first cut)

The film uses the app's **second spectrum option, `peaks`** (28 bars with floating caps, «قِمم»), not the ribbon — Adel's call. Beat structure, camera, timing and audio are unchanged. Two consequences, both real and both traceable to the app:
- the picture is a **frequency** spectrum: one flat blue in 28 columns, not four layered silhouettes;
- **the pause decays instead of collapsing.** The analyser (`smoothingTimeConstant 0.75`, read every 2 frames) loses only ~3 dB per 66 ms, so the bars sink to roughly 0.4 over a second and stay — verified against a live Chrome analyser on the same audio. The ribbon's flat line in the pause was the stronger image; the bars are the app's actual `peaks` behaviour, so the film now shows that instead.

## 0b. Amendment (v2: two spectra, one pipeline)

The film now ships in **four versions**: 21 s and 32 s, each with `waves` (the app's current ribbon, a scrolling loudness history) and `bars` (`peaks`). Choose with `?mode=waves|bars`; `render.mjs` renders either. One generator, `src/data.py`, makes the data for both. The old per-shape scripts (`peaks-film.py`, `wave-film.py`, `wave.py`) are removed.

- The 21 s film gains the address **tilawah.cc** under the wordmark at 20.30 s. The hook camera is unchanged apart from its re-timed turn (pull-back to 3.40, push 3.40–7.20); the opening is still the stillest stretch.
- The 32 s story is rewritten around the ring, accounts and the web seed (see `NOTE-32.md`).
- The audio beds were rebuilt and normalised: both at −16.0 LUFS; true peak −1.5 dBFS (21 s) and −3.1 dBFS (32 s).
- `mobile-intro` (9:16) was not re-rendered and still shows the previous ribbon. Treat it as superseded until it is rebuilt on `spectrum.js`.
- Repo hygiene: scratch JSON, `make32.py`/`patch32.py` (they would overwrite `index32.html`) and an unused third recitation (Maher al-Muaiqly mp3) were removed from the tree. The mp3 stays in git history. Please confirm you hold the rights to the two remaining recitations before publishing the videos.

## 1. The idea, in one line

**The page draws the voice, then gets out of the way.** The film never leaves the real player page: the spectrum *is* the voice, the page's silences are content (a pause between ayat sinks the bars to the floor), one click in that silence changes the voice — and the shape changes with it.

Why it belongs to this brand and not to the category: the app's own copy says the point — «تلاوة اسم الفعل لا اسم التطبيق… المهم الصوت والوقفة والآية، لا الشاشة». The film performs that sentence instead of writing it. Cover the logo and it is still Tilawa: a white page, one blue ridge, Arabic, silence treated as content. Swap in another Qur'an player and there is nothing left to watch.

Rejected in planning: a wave that morphs into the logo (category costume), and a typographic essay on the brand line (type on paper, no product).

## 2. What each beat buys

| t | beat | what it buys | how |
|---|---|---|---|
| 0.0–4.2 | hook | this is a quiet page where something real is already being drawn | the real page at 1.30→1.16: title, reciter, the 28 bars, the transport; the bars sink into the first pause at 3.34 |
| 4.2–7.2 | proof | the spectrum **is** the recitation, silence included | one continuous camera: pull-back, turn, push to 3.2×; the bars lift at 4.74 as the voice returns |
| 7.2–10.0 | turn | the archive is real, and one click changes the voice in place | hard cut to the page, the roster docks in real app behaviour (the column slides 180 px), camera dives to 3.2× into the rows, the arrow picks «محمود خليل الحصري», the sheet retracts |
| 10.0–17.0 | proof / hero | every voice has its own spectrum | the camera pushes 1.00 → 4.20 while V2 begins on its first syllable; the bass columns peak at 13.0, then sink into the long pause at 13.58 |
| 17.0–21.0 | cta | the name belongs to the thing you just watched | cut inside the pause to 2.60×; the voice returns at 17.70; the wordmark lands 19.55 at 1.20× and settles; the bars stay alive to the last frame |

Two cuts only (7.20, 17.00) plus the wordmark's arrival. The film is one page, one camera, and one handover from sound to name.

## 3. What is real, what is built

**Real**
- Both recitations: `Mohammed_Seddiq_Al_Minshawi/001.mp3` (2.00–12.00 s) and `Mahmoud_Khalil_Alhusari/001.mp3` (16.18–27.18 s), from the catalogue (rights with the reciters/publishers via Itqan). Loudness-matched (+4.4 dB / −4.8 dB).
- The spectrum: a faithful port of `apps/web/src/components/visualiser.tsx` **`drawPeaks`** + `utils/visualiser-models.ts` **`downsample`** on top of a Web Audio AnalyserNode — `fftSize 1024`, `smoothingTimeConstant 0.75`, Blackman window, `minDecibels −100 / maxDecibels −30`, 28 columns mapped by `(i/28)^1.4` over the lower 60 % of the bins, bar height `pow(level, 0.65)`, caps at `pow(peak, 0.65) − 2 px`, peak decay `−0.008` per read, levels 0.5 up / 0.14 down, one analyser read every 2 frames. `film/src/peaks-film.py` reproduces the chain and is calibrated against a live Chrome analyser (a 0.5-amplitude 440 Hz sine reads −19.78 dB in its peak bin, byte 255).
- Every Arabic string, the type (IBM Plex Sans Arabic 400/600, the brand's woff2), the token colours (`#1c4d78` → `#5d97c9`, ink `#111`, line `#e8e8e8`), the wordmark PNG.
- The geometry, measured from the live page: title y 237.6 / 56 px / 600; reciter 309.6 / 16 px; ribbon 520×160 at (700,683); rail 448 px; transport 72 px; roster 360 px docked right; rows 64 px; the 180 px column shift when the panel docks.
- The roster's names, riwayat and counts (read from the live app: 1 peer session, 853 KB/s).

**Built for the film (declared)**
- The page is a rebuilt DOM fragment, not a screen recording; the camera is not a screen recorder.
- The paper fibre and mottle (0.055 / 0.018) is added — the app is pure `#ffffff`.
- The arrow is designed (one pointer, page space, 22 px, scale 0.90 on press).
- The 1.32 s pause across the reciter change is compressed: the real app buffers a new torrent for seconds.
- Two UI ticks (a soft dock at 7.20, a press at 9.08) are synthesised, not sampled from the app.

**Not shown, on purpose:** peers, buffering, the HTTP fallback, the ring. Nothing invented stands in for them. (The `film/screens/` library has those screens for a longer or 9:16 cut.)

## 4. Gates

*(numbers below are from `look.py` / `lint.mjs` on this render — see §7)*

| Gate | Result |
|---|---|
| G0 render exists | PASS — 21.00 s, 630 frames, audio present, audible 0–21 s |
| G1 proof readable | ridge at 3.2× = 0.87 W; at 4.2× = 1.14 W cropped by both edges. Roster rows at 3.2× = 51 px = 0.047 H, panel 0.60 W. Checked on `look/sheet.jpg` and the stills. |
| G2 no empty frame | PASS — no run of >3 flat frames |
| G3 end card / CTA share | PASS — end hold 0.23 s (the bars settle for the last 7 frames; the recitation does not stop); final shot (last event 19.53 → end) 1.47 s = 7 %; the close beat 17.00–21.00 = 4.0 s = 19 % |
| G4 one hero per frame | one object in every proof frame; the roster is a panel the camera moves into |
| G5 no page chrome | PASS — `lint.mjs`, all rules (the page fragment is marked `data-ui="captured"`, which exempts the app's own chrome: scrubber, times, transport) |

**Audio:** −16.0 LUFS integrated, LRA 6.1 LU, true peak −1.5 dBFS. `look.py` flags two "digital-silence dropouts" (13.75–14.34, 17.14–17.66): those are the recitation's real pauses between ayat — the subject of the film, not a fault.

**Motion:** mean frame-to-frame change **1.4/255** against the human band median 6.8 (IQR 4.4–9.8) — **well below the band**, and it dropped from 3.4 when the film moved from the ribbon to `peaks`: 28 flat bars change less of the frame than four filled silhouettes, and the analyser's slow decay keeps them nearly still through a pause (0.93–4.73 s is the stillest stretch). This is the clearest cost of the amendment. A quiet brand justifies some of it; 1.4 is low enough that I would consider a slow push inside the hook to give the opening a heartbeat.

## 5. The frames, one sentence each

1. **0.6 s** — the page close in: الفاتحة, the reciter line, 28 blue bars with their caps, the scrubber, the black play disc.
2. **3.3 s** — the bars sink as the reciter pauses (they decay, they do not snap to a line).
3. **5.2 s** — the same bars at 2×, filling the lower half, silence above.
4. **6.2 s** — the push continues; the bars are low and wide, the page's sky empty.
5. **7.4 s** — the roster slides in from the right and the page column slides off centre.
6. **8.6 s** — the camera is inside the rows: Arabic names at 51 px, riwaya pills, real counts, the arrow arriving.
7. **9.1 s** — the arrow presses «محمود خليل الحصري»; the row goes semibold.
8. **9.8 s** — the sheet retracts, the page comes back whole.
9. **12.4 s** — 4.2×: the bars fill the frame, bass columns tallest at the right, caps floating.
10. **13.0 s** — the hero: the second voice's spectrum at full width, no chrome in frame.
11. **15.0 s** — the bars have sunk into the long pause and the camera drifts.
12. **18.2 s** — 2.6×: the bars low, the scrubber at 0:23, paper everywhere.
13. **19.6 s** — the wordmark arrives blurred at 1.18× over the bars.
14. **20.6 s** — the mark settled at 0.28 W, the bars still alive underneath.

## 6. What I would still improve

- **The first 2.5 s are the stillest stretch** (`look.py`: static-ish 3.60–4.77 s). The pull-back is slow and the ridge is only 0.27 W wide. One option is to open already at the macro (a 2-frame hold) and pull back from there; another is a slightly faster pull. I chose the calm version and would want to see both.
- **The macro's sky.** At 3.2× the top 40 % of the frame is empty paper for ~1 s. It is the page's real composition, but on a phone/feed that emptiness is the weakest moment (same finding as the 9:16 test).
- **`peaks` vs `ribbon`** (the amendment). The bars read as a graphic equaliser and hold their height through a pause; the ribbon read as a landscape and collapsed to a line. If the pause ever needs to be the point again, the ribbon is one line in `drawRibbon`.
- **The reciter change is fast** (1.32 s from dock to pick to retract). It reads at 30 fps, but a viewer who looks away misses the cause; the 9:16 cut should give it 3 s.
- **No copy at all.** The film is deliberately wordless (the page's own Arabic is the only text). For a launch post that needs a claim, the line «المهم الصوت والوقفة والآية، لا الشاشة» is the one to add — 2 s, before the mark, not after.

## 7. How to re-render / verify

```
node render.mjs --page index.html   --mode waves --audio audio/mix.wav   --out final-21-waves.mp4
node render.mjs --page index.html   --mode bars  --audio audio/mix.wav   --out final-21-bars.mp4
node render.mjs --page index32.html --mode waves --audio audio/mix32.wav --out final-32-waves.mp4
node render.mjs --page index32.html --mode bars  --audio audio/mix32.wav --out final-32-bars.mp4
python3 src/data.py          # regenerates peaks-*.js and ribbon-*.js from audio/*-norm.wav
```

Needs node, playwright (chromium) and ffmpeg. About 2.5 to 4 minutes per video on 2 CPUs.
