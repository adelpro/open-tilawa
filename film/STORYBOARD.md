# فيلم تلاوة — STORYBOARD (v1, design only)

Working title: **الصفحة التي ترسم الصوت** — the page that draws the voice.
Target: 1920×1080, 30 fps, **21.0 s (630 f)**. Sound: the recitation itself — no music, no voice-over.

Deliverables of this stage: this file + `film/screens/` (8 frames, rendered from `film/screens.html`).

> **Amendment after the first cut (Adel's note):** the film uses the app's **second spectrum option, `peaks`** — 28 bars with their floating caps (`VISUALISERS[1]`, «قِمم») — not the `ribbon`.
> Beat structure, camera, timing and audio are unchanged. What changes:
> - the four blue silhouettes become one flat blue (`tints[0]`) in 28 columns, index 0 at the right edge (RTL);
> - the picture is now a **frequency** spectrum, so it reads as a graphic equaliser, not a landscape;
> - **the pause no longer collapses to a line**: an AnalyserNode with `smoothingTimeConstant 0.75` read at 15 Hz only decays ~3 dB per 66 ms, so the bars sink to ~0.4 over a second and stay there. That is the app's real behaviour (verified against a live Chrome analyser), and it is the one thing the ribbon did better.
> - data: `src/peaks-film.py` → `src/peaks-film.js` (630 frames), calibrated against a live tone (0.5 amplitude at 440 Hz reads −19.8 dB in its peak bin).

---

## 1. PAGE

| | |
|---|---|
| **Problem** | Qur'an apps are cluttered with chrome — accounts, upsells, playlists, counters — when the listener came for one voice and one pause. The screen competes with the recitation. |
| **Audience** | An Arabic-first listener who lands on tilawah.cc from a link, a tweet, or a friend. Phone or laptop. Sound on within a second, because the page *is* a player. |
| **Goal** | Press play. Remember the name. Believe this page is quieter than every other Qur'an app. |
| **Emotion** | Starts: "another app." Ends: the exhale of a page with nothing on it but the voice — and the small pleasure of hearing, and seeing, that the *shape* changes when the reciter does. |

**The one true thing:** the spectrum is not decoration — it is the recitation drawn live, silences included. A pause between ayat is a flat line on the page. That is the product's own signature (`apps/web/src/components/visualiser.tsx`: four filled silhouettes, one hue, `FILL_GAIN 0.65`).

---

## 2. Brand inventory (live capture, `film/brand/`)

| Look at | What it actually is | What the film takes |
|---|---|---|
| The mark | The Arabic word **تلاوة** alone, ink `#1F4D78` (`public/images/icon.png`, 812×385, alpha, baked drop shadow). No pictogram. | The mark arrives once, at the end, in its real blue. Never redrawn. |
| Core control | The black play circle, 72 px — the only filled shape on the page. | A reference for scale; never a beat of its own. |
| Signature material | The ribbon: 4 filled silhouettes, tints `#1c4d78 → #5d97c9`, alpha 0.72→0.30, four gains/follows/shifts. | **The film is about this.** Drawn with the app's own algorithm, fed the real audio. |
| Key verb | يستمع / يقرأ — and the app's own line: «تلاوة اسم الفعل لا اسم التطبيق». | The name is the act; the last frame puts the name over the act drawing itself. |
| Success moment | The ridge lifts under the title, the time runs, the reciter line is there. | Frame 0 is already inside that moment. |
| Voice | Quiet, plain, Arabic-first, no marketing: «ولا شيء بينك وبين الصوت». | No slogan on screen. The only words are the page's own Arabic. |
| Colour logic | One hue, one meaning. Red exists only for refusal. | Blue = "the voice is here", on the wave and on the mark. |
| Type | IBM Plex Sans Arabic 400/600. Title 56 px, reciter 16 px, UI 16/12 px. | The brand's own files, real sizes, magnified by the camera only. |
| Never | Neon, glow, glass, gradient decoration, English-first marketing, a URL strip. | None present. |

Geometry measured from the live page (1920×1080): title top 237.6 / 56 px / 600; reciter 309.6 / 16 px; ribbon 520×160 at (700, 683); scrubber rail 448 px at y 881; transport 72 px at y 919; footer from 1023; roster panel 360 px wide from the right edge, from y 56; rows 64 px.

## 3. First idea, then two of other kinds

1. **First idea (discarded):** a blue wave sweeps the screen and settles into the logo. *A waveform-to-logo transformation is the category's costume and the most over-used shape in the reference set; it says nothing about the pause, the page, or the archive.*
2. **Typographic essay in the brand's voice:** «المهم الصوت والوقفة والآية، لا الشاشة.» with the words performing their meaning, «الشاشة» erased as the wave rises. *Beautiful, but type on paper with no real product in it — the "too sparse / type alone" verdict.*
3. **UI documentary of one listening session (chosen).** The film stays on the real page: a recitation already playing draws its own profile; the page empties when the reciter pauses; the roster is opened in that silence and another voice is picked; the profile changes shape; the page ends with the name and the recitation still going.

**Why 3 wins:** cover the logo and it is still this app — a white page, one blue ridge, Arabic, silence treated as content. Swap in a competitor with the same colours and the film collapses: no other Qur'an player draws silence as a floor, and none would let the screen stay this empty. Every joint is the product's own behaviour, not a claim about it.

**Deliberately omitted:** the peer-to-peer story (no server, peers, the fallback). It is infrastructure, invisible to a viewer, and any diagram of it would be invented footage. The film sells the experience; the docs sell the architecture.

---

## 4. Film system (decided once)

| Field | Decision |
|---|---|
| Shape | **UI documentary of one listening session** — one page, one camera, one cut of consequence (the reciter change), one cut to the close. |
| Length | 21.0 s = 630 f @ 30 |
| Clock | Smooth 30 fps. |
| Motion grammar | **Shutter blur** (`render.mjs --shutter 180 --subframes 8`). The camera is the only fast mover; the ribbon must stay crisp. |
| Type | IBM Plex Sans Arabic 400/600, the brand's woff2. Only the page's own strings: «الفاتحة», «محمد صديق المنشاوي», «محمود خليل الحصري», «القرّاء», row names, «حفص/ورش/قالون/Douri». No independent type animation. |
| Ground | The page: `#ffffff`, a paper fibre + mottle grain (0.05 / 0.018), one soft key from the upper left, the `--line #e8e8e8` hairline. One world for all 21 s — the brand is flat on purpose, so it is a *lit* flat, not a swatch. |
| Accent | `--wave-front #1c4d78` / `--wave-back #5d97c9` in the four tints only. One meaning: **the voice is present**. The mark arrives in the same blue: the name is the thing. |
| Carrier | The ribbon. Page scale 1.30 → 1.16 → 3.20 → 1.00 → 3.20 → 4.20 → 4.30 → 2.60. Never pinned, never redrawn. Two cuts only (7.20, 17.00). |
| Cursor | One arrow, 26 px, screen size (it is the viewer's pointer, not page content); used once, over the roster. |
| Importance budget | B1 = 2, B2 = 2, B3 = 2, **B4 = 3**, B5 = 1 → one "point" in five beats (20 %). |
| Hero moment | **f 390 (t 13.00, 61.9 %)** — the ridge at 4.2×, four blues, mid-phrase, rising from the frame's bottom edge (`stills/still_13.00s.png`). Made with the real algorithm fed the real recitation at that second. |
| Overshoot | None. The camera decelerates; nothing springs. |
| Sound | **No music, no voice-over.** ElevenLabs is not configured, and more importantly the recitation is the score: two real catalogue recordings (rights with the reciters/publishers, via Itqan), joined at a silence, loudness-matched. Two UI ticks. |

### World per act

| Act | Ground | Light | Depth | Texture | Sound |
|---|---|---|---|---|---|
| 1 — 0–7.2 s | the page, 1.30 → 3.20 | key top-left, 3 % falloff | page → ink | paper fibre | the recitation, already running |
| 2 — 7.2–10.0 s | the page + the roster panel (same paper, `--line` edge, 12 px contact shadow) | same key; the panel sits 2 px above the page | panel over page | same grain | page quiet — this is the long pause |
| 3 — 10.0–15.8 s | the page at 4.2× — ink only | the key grazes the ridge tops | ink over paper | grain visible at 4× | the second voice |
| 4 — 15.8–21.0 s | the page, quieter, then the ridge alone | the same key, nothing else | page → ink | grain | the voice, then the name |

---

## 5. Beats (as built)

**Audio map** (real files, matched to −19 LUFS integrated; V1 +4.4 dB, V2 −4.8 dB):

| Voice | File | Film start | Audio start | Runs to |
|---|---|---|---|---|
| V1 محمد صديق المنشاوي | `.../Mohammed_Seddiq_Al_Minshawi/001.mp3` | 0.00 s | **2.00 s** | film 10.00 s (audio 12.00) |
| V2 محمود خليل الحصري | `.../Mahmoud_Khalil_Alhusari/001.mp3` | 10.00 s | **16.18 s** | film 21.00 s (audio 27.18) |

Silences that land in the film: **3.34–4.74** (V1), **8.68–10.00** (V1 — the roster opens in it), **13.58–14.42** (V2), **16.88–17.70** (V2 — the close cuts into it). The seam at 10.00 s sits at the end of V1's silence and on V2's first syllable: the new voice is the transition.

| # | Role | Imp. | Buys | Picture, text covered | Copy on screen | What moves | Enters how | Exits how | Frames |
|---|---|---|---|---|---|---|---|---|---|
| 1 | hook | 2 | …that this is a quiet page where something real is already being drawn | a lit paper field; a blue ridge, low and wide, on a hairline; the transport below | الفاتحة · محمد صديق المنشاوي | the ridge breathes; camera 1.30 → 1.16 | already mid-phrase at f 0 | the ridge falls into the first pause (3.34) and the camera turns | 0–126 |
| 2 | proof | 2 | …that the wave **is** the recitation, silence included | the same ridge at 1.16 → 3.20×, silence above it, controls falling out of frame | — (page text out of frame) | camera pulls back, turns at 4.2 s, pushes to the macro; the ridge lifts at 4.74 | no cut: one continuous camera | cut on the push | 126–216 |
| 3 | turn | 2 | …that the archive is real, and one click changes the voice in place | a paper panel of Arabic names docking over the page; an arrow on a row | القرّاء · الحصري · المنشاوي · حفص · ورش | panel slides in; the page column shifts 180 px; camera dives 1.00 → 3.20 into the rows; the arrow parks, presses; the sheet retracts; camera back to 1.00 | hard cut from the macro, panel already moving | the voice changes on the first syllable of V2 | 216–300 |
| 4 | proof / **hero** | 3 | …that every voice has its own landscape | the ridge at 4.20×, taller and jagged, four silhouettes, floor near the frame's bottom | — | camera 1.00 → 4.20 by 13.0; the ridge peaks at 13.0; collapses into the pause at 13.58; the camera drifts | no cut: V2's first syllable starts the push | cut inside the pause | 300–510 |
| 5 | cta | 1 | …that the name belongs to the thing you just watched | the ridge at 2.60×; the wordmark above it | **تلاوة** (real logo PNG, `#1F4D78`) | cut to 2.60× inside the pause; voice returns 17.70; mark arrives 19.55 at 1.20× and settles; the ridge stays alive to the last frame | hard cut from the macro | ends mid-phrase | 510–630 |

Lengths: 126 + 90 + 84 + 210 + 120 = 630. CTA 120 f = **19 %** ✓. Final shot (last cut 17.00 → end) = **4.0 s = 19 %** ✓. Hero at 61.9 % ✓.

### Seams as built

1. **B1 → B2** (f 126, 4.20 s): no cut. One camera runs 0 → 7.2 s: pull back to 1.16, velocity reaches zero at 4.2 as the pause begins, then the push starts from that stillness. The turnaround is the seam, not an edit.
2. **B2 → B3** (f 216, 7.20 s): hard cut on the push. B3 opens at 1.00 with the panel already sliding (it is 40 px inside the frame on frame 216) and the page column sliding 180 px left — the app's own behaviour when the roster docks.
3. **B3 → B4** (f 300, 10.00 s): no cut. The camera has returned to 1.00 and V2's first syllable both starts the beat and begins the push to 4.20. The voice is the transition.
4. **B4 → B5** (f 510, 17.00 s): the ridge is already flat (the pause began 16.88). The cut to 2.60 lands 0.12 s inside the silence; the voice returns at 17.70 and the mark lands at 19.55.

### Gates checked at storyboard stage
- **G1** — proof objects: ridge at 3.20× = 0.87 W, at 4.20× = 1.14 W (cropped by both edges); roster rows at 3.20× are 51 px = 0.047 H with the panel at 0.60 W.
- **G3** — end hold 0.0 s (the film ends mid-phrase on purpose), final shot 19 %, CTA 19 %.
- **G4** — one object per proof frame; the roster is a panel the camera moves into.
- **G5** — no corner labels, counters, kickers or invented bars. The only chrome is the app's own page, marked `data-ui="captured"` (the linter's documented exemption for a captured product screen): title, reciter, scrubber, transport, roster.

## 6. What is real, what is built

- **Real:** both recitation files (catalogue; rights with the reciters and publishers via Itqan); every Arabic string; the wave drawn by a faithful port of `visualiser.tsx` (`film/src/wave.py` reproduces the analyser smoothing, `autoGain`, `FILL_GAIN 0.65`, the four gains/follows/shifts, the four tints); the token colours; the type; the geometry (measured from the live page); the roster's names, riwayas and counts (read from the live app).
- **Built for the film (declared):** the page is a rebuilt DOM fragment, not a screen recording; the camera is not a screen recorder; the cursor is designed; the paper grain is added; the loudness match is a mix decision; the sheet's arrival is compressed (the real app takes a second to open).
- **Not shown:** peers, buffering, accounts, the fallback — nothing invented stands in for them.

## 7. Screens (`film/screens/`)

| File | t | Camera | What it shows |
|---|---|---|---|
| `S1.png` | 0.60 s | 1.20× | the page band at rest: title, reciter, ridge, scrubber, transport (header and footer cropped — G5) |
| `S2.png` | 4.20 s | 1.16× | the pause — the ridge is a 2 px ripple on the hairline |
| `S3.png` | 7.00 s | 3.20× | the macro: four silhouettes, the scrubber below, empty paper above |
| `S4.png` | 8.90 s | 1.00× | the roster docked; the page column slides 180 px off centre |
| `S5.png` | 9.60 s | 3.00× | the pick: rows at 0.044 H, the arrow on «محمود خليل الحصري» |
| `S6.png` | 13.00 s | 4.20× | **hero** — the second voice's landscape |
| `S7.png` | 14.20 s | 4.20× | the long pause, same shot as the hero — the ridge falls to a low ripple |
| `S8.png` | 20.50 s | 2.60× | the close: the wordmark over the living ridge |

## 8. Open decisions for Adel

1. **The reciter switch (B3)** costs 2.8 s and is the only interaction. Keep it, or replace it with the surah list, or drop it for a pure held shot (the film becomes ~18 s)?
2. **The brand line** «المهم الصوت والوقفة والآية، لا الشاشة.» is currently *performed*, not written. Written, it needs ~2 s and turns the close into two endings. Recommended: keep it out.
3. **The domain** «tilawah.cc» under the mark — practical for an intro, but it would be the only Latin text in the film. Recommended: leave it out (the film lives on the site).
4. **Format** — this board is 16:9. A 9:16 cut is a different edit (the page is wide), not a crop.

*Next step after approval: build `film/index.html` with the real runtime and the real wave data, mix the two recordings, then run `look.py` and `lint.mjs`.*

---

## 9. The 9:16 cut (phone) — and why it is not a crop

**The measurement that decides it.** On a phone the ribbon is 96 px tall inside an 844 px screen — **11 % of the screen**. Scale the app's screen to fill a 1080-wide frame and the ribbon's ridge tops out around **0.08 H**. On 16:9 the wave can be a hero (S6). On 9:16 it is a thin blue line over a lot of white. Cropping the 16:9 film to 9:16 therefore produces absence, not minimalism.

**So the mobile cut changes shape, not size:**

1. **0.0–1.0 s — the phone arrives.** A real device (656×1378 at 1080×1920, 18 px bezel, dynamic island, contact shadow, one rim) rises from below the frame at 1.04× with an 8 px blur, decelerating, no bounce. Frame 0 is already mid-move.
2. **1.0–2.6 s — the page plays** inside the glass; the app's own header, ribbon, scrubber, transport, footer. A 0.6 % drift keeps it alive.
3. **2.6–3.7 s — the dive.** The camera pushes 1.00 → 1.74× into the screen and lands on the app's middle (header and footer cropped by the frame). The bezel sweeps out of frame at ~3.2 s: the object hands over to the page.
4. **3.7–5.2 s — the pause, then the voice.** The ridge is flat (the recitation is between ayat), then V1 returns at 4.4 s and lifts it. A designed breath, 0.7 s in frame.
5. *(next 6–8 s, not in this preview)* **the roster as a bottom sheet** rises from the bottom edge — the mobile gesture — and its rows at 1080 wide are the 9:16 hero: 28–48 px Arabic, the riwaya pills, the counts. Tap, sheet retracts, V2 answers, the ridge changes shape.
6. *(close)* the ridge alone, then the wordmark at 0.28 W.

**Why the phone is allowed here and not in the 16:9 film:** the product is a PWA opened on a phone; the device is its actual context, not a prop on a void. It is lit, it has a contact shadow and a rim, it enters by motion, and it exits by the camera passing through it — no glow, no gradient, no third colour, no floating mockup.

**Rendered preview:** `film/mobile-intro.mp4` (1080×1920, 5.2 s, 156 f, with sound) and `film/mobile-intro.gif`; stills in `film/mobile-stills/`; the page is `film/mobile.html`, the wave data `film/src/wave-mobile.js` (per-frame traces at audio 2.34 s → 7.54 s of V1).

**The honest weakness.** At 3.7–4.4 s the frame is a horizontal line in 70 % white — on a phone in a feed that reads as a blank screen before the sound explains it. If the cut goes to social, the pause has to shorten to ~0.4 s, or the sheet has to arrive early enough that the emptiness is *inside* a gesture instead of waiting for one.

---

## 10. Product screens (the library the film draws from)

Five more frames at the same camera (1.00×, page shifted 180 px off centre, panel docked — the app's own behaviour), added so the film has real material for anything longer than 21 s, and so the 9:16 cut has its hero.

| File | Panel | What is real in it |
|---|---|---|
| `S9.png` | **الحساب** (logged out) | «حلقة جديدة» + the ring note («الحلقة مفتاح يُولَّد هنا ويُحفظ في هذا المتصفح — لا اسم مستخدم ولا كلمة مرور»), «اسم الحلقة», «إنشاء حلقة»; «الانضمام إلى حلقة» + «امسح رمزاً…» + «المسح بالكاميرا / إدخال الرمز يدوياً» |
| `S10.png` | **السور** (the playlist) | 12 rows of the mushaf: الفاتحة 7 آيات · الجزء 1 · 804 KB … يوسف 111 آية · الجزء 12 · 39 MB; the playing row in semibold; the search «ابحث باسم السورة أو رقمها» |
| `S11.png` | **تفاصيل البث** — connected | المصدر P2P · الأقران 1 · التنزيل 853 KB/s · الرفع 110 B/s · المُنزَّل 0 B · التقدّم 0.0% · الملفات 114 · البديل متوفّر |
| `S12.png` | **تفاصيل البث** — waiting | المصدر بانتظار الأقران (with the animated glyph) · 0 peers · «لم يتصل أي قارئ بعد. التشغيل يبدأ عندما يظهر أوّل قرين.» · البديل متوفّر |
| `S13.png` | **تفاصيل البث** at 2.80× | the same eight rows, legible: 14 px × 2.8 = 0.036 H |

The numbers are read from the live app (a real 1-peer session at 853 KB/s), not invented. One honest detail kept on purpose: the bidi order renders `853 KB/s` as «KB/s 853» and `0 B` as «B 0» — that is what the app itself shows, so the screen reproduces it instead of prettifying it.

**Where these belong:** not in the 21 s film (five more beats would triple it). They are (a) the source for a 30–35 s cut, (b) the 9:16 hero (the roster and the surah list are the only places on a phone where real Arabic UI reads at 28–48 px), (c) the frames a landing page can still.

## 11. The two mechanics the screens have to explain

### The wifi glyph is the only animation in the app

`components/icons.tsx` + `globals.css`:

```
.wifi-arc      animation: wifi-arc 1.5s ease-in-out infinite   (opacity .35 → 1 → .35)
.wifi-arc-2    animation-delay: .5s                            (the middle arc follows)
.wifi-dot      animation: wifi-dot 1.5s ease-in-out infinite   (peaks at 40 % = .6 s)
prefers-reduced-motion: animation: none; opacity: 1
```

Three strokes — outer arc 4.5→19.5, middle 7.8→20.6, dot 10.9→13.1 — drawn at the same 1/16 optical weight as Phosphor regular so it sits beside the rest of the set. It is chosen by one function, for one state:

```
iconForSource('waiting')  → wifi-waiting   (no peer has answered yet)
iconForSource('connected')→ wifi
iconForSource('webseed'|'mixed') → server  (our own /media origin, not a link)
```

It appears in the footer ring and in the stream sheet's source row, with the same meaning in both — the app used to pick two different glyphs and they drifted, so the mapping now lives in `utils/stream-source.ts`.

**What it means in the film:** it is the P2P claim made visible without a diagram. The moment before the recitation starts is a glyph that *repeats the search*: three arcs answering in turn. A loading spinner would be a generic lie; this one is the product telling you what it is waiting for.

### P2P first, HTTP as the fallback (8 seconds later)

1. The player asks the tracker who has the surah. The tracker answers with addresses, never audio.
2. The audio arrives over BitTorrent — from the seeder and from other listeners who already have the file. The source row says **P2P**; the peer count, speeds and per-file progress are real numbers from the running torrent.
3. If **8 s** pass with `ready && peers === 0 && progress < 1`, `shouldAddWebSeed()` gives the same torrent an HTTP source at its own origin — `/media/<folder>/<NNN>.mp3` — and the pieces it delivers are verified and shared with peers like any other. The source row then says **HTTP**, or **P2P + HTTP** once a peer joins too.
4. The last row answers the only question a listener has when nothing plays — *is there another source?* — with one `HEAD` request: **البديل: متوفّر**.

**In the film:** this is the one place where a wait is content rather than dead time. A 1.2 s beat on the waiting state — the arcs answering, «بانتظار الأقران», the fallback already saying متوفّر — then the first syllable. It makes the film's most abstract fact (no server holds the recitation) visible in the product's own words, with no diagram, no arrow, no invented chart.

---

## 12. The 32 s cut (option b) — the page, the archive, the ring, the source

The long cut keeps the 21 s film's first ten seconds **frame for frame**, then opens three more layers of the same page. The rule that keeps it from becoming a feature tour: **the recitation never stops** — the panels are what you do *while listening*, and the only cuts are the camera's.

| t | shot | what happens |
|---|---|---|
| 0.0–7.2 | the page | pull back to 1.16, the first voice, the pause at 3.34, the turn and the push |
| 7.2–10.0 | القرّاء | the roster docks, the column slides 180 px, the camera dives to 3.2×, the arrow picks الحصري at 9.08 |
| 10.0–13.8 | the second voice | push 1.00 → 4.20, the spectrum at full width |
| 13.8–17.4 | السور | cut; the mushaf docks; push 1.00 → 2.80 on rows 1–4 (الفاتحة 7 آيات · 804 KB, البقرة 286 آية · 119 MB) |
| 17.4–21.4 | الحساب | cut; the panel docks; push 1.00 → 2.80; «البيت» typed into the field, the caret running |
| 21.4–26.2 | تفاصيل البث | cut; push 1.00 → 2.80; **بانتظار الأقران** with the arcs answering, 0 peers, البديل متوفّر — then at 23.90 a peer answers: P2P, 1 peer, 853 KB/s |
| 26.2–29.4 | the page | cut back to 1.2; the bars, the recitation |
| 29.4–32.0 | the close | cut to 2.6; تلاوة lands at 30.50, settles, holds |

**Audio:** V1 المنشاوي 2.00–12.00 s (film 0–10), V2 الحصري 10.00–32.00 s (film 10–32), continuous through every cut. The only new sounds are four dock ticks, three keystrokes and one low hit when the peer answers at 23.90.

**What each new beat had to earn:**
- **السور** — the archive is complete: 114 rows with real verse counts and the real torrent sizes (البقرة 119 MB is the one you feel).
- **الحساب** — ownership without an account: «الحلقة مفتاح يُولَّد هنا … لا اسم مستخدم ولا كلمة مرور», performed by typing a name into the product's own field.
- **تفاصيل البث** — the P2P claim in the product's own numbers, in one unbroken shot: waiting → a peer → 853 KB/s → «البديل: متوفّر». No diagram, no arrow, no invented chart.

Source: `film/index32.html` · `film/src/peaks-32.js` (960 frames) · `film/audio/mix32.wav` · delivered as `film/final-32.mp4`, written up in `film/NOTE-32.md`.
