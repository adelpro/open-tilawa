# فيلم تلاوة — 32 s cut (v2: seeds, rings, accounts)

Four deliverables share one pair of pages (`index.html` 21 s, `index32.html` 32 s) and one spectrum module (`src/spectrum.js`):

- `final-21-waves.mp4`, `final-21-bars.mp4`: 21.0 s, 630 frames
- `final-32-waves.mp4`, `final-32-bars.mp4`: 32.0 s, 960 frames

1920×1080, 30 fps, H.264 + AAC, −16.0 LUFS. `waves` is the app's current ribbon (a loudness history that scrolls left, after PR #1). `bars` is `peaks` (28 columns with caps). Only the spectrum differs between a waves and a bars video.

Render: `node render.mjs --page index32.html --mode waves --audio audio/mix32.wav --out final-32-waves.mp4`.

---

## 1. What changed from v1

v1 of the 32 s cut showed **بانتظار الأقران** (waiting for peers) while the recitation was already playing, which contradicts itself, and it never said where the sound came from. The ring was a form with a typed name and nothing after it. v2 fixes both and keeps the rule that the recitation never stops.

| t | shot | what happens | why it holds |
|---|---|---|---|
| 0.0–7.2 | the page | pull-back, the first voice draws itself, the pause at 3.4, push in | the hook |
| 7.2–10.0 | القرّاء | roster docks, arrow picks الحصري at 9.08 | one click, one consequence |
| 10.0–13.8 | the second voice | push to 4.2× on the spectrum | the new voice's shape |
| 13.8–17.4 | السور | the archive: 114 rows, real verse counts and sizes | the library |
| 17.4–23.0 | الحساب | «البيت» is typed, **إنشاء حلقة** is pressed, the ring appears (**حلقتك: البيت**, **جهاز واحد**, this device **الأساسي**); **إظهار رمز الربط** shows a QR with **ينتهي خلال 120 ثانية** counting down; at 22.00 **تمت إضافة الجهاز إلى الحلقة**, the list shows two devices, **جهازان** | **the ring and accounts**: a key on the device, a one-time code, a second device joins |
| 23.0–28.4 | تفاصيل البث | opens on **HTTP**, 0 peers, 640 KB/s, البديل متوفّر: the web seed is already serving. At 25.60 a peer joins: **P2P + HTTP**, 1 peer, 853 KB/s up 110 B/s | **the seed**: sound starts from the web seed, peers take over |
| 28.4–29.6 | the page | the spectrum again | the room |
| 29.6–32.0 | the close | cut to 2.6×; **تلاوة** lands at 30.20, **tilawah.cc** fades in at 30.95 | the name and where to find it |

The panel cuts now match what the app does: the web seed answers after the P2P wait, stays connected, and the pieces a listener has received can be shared.

## 2. What is real

- Both recitations: المنشاوي (source 2.00–12.00 s) then الحصري (source 11.05–33.05 s), loudness-matched and joined at a pause. 11.05 is an onset, so the voice runs unbroken to the last frame.
- The spectrum: `bars` is a port of `drawPeaks`; `waves` is a port of the ribbon in `apps/web/src/components/visualiser.tsx` (30 Hz reads, `peakMagnitude`, envelope attack .25 / release .06, `autoGain`, a push every 60 ms, per-layer rise and fall, draw gains 1/.8/.62/.46). `src/data.py` generates both from the same audio.
- Every UI string on the account and stream sheets, the sources (HTTP, P2P + HTTP), the 2-minute code lifetime, the keypair-on-device model.
- The roster names and counts, the surah list, the geometry.

## 3. Built, declared

- **The ribbon history before t=0.** The ribbon is a history, so at frame 0 it must already be full. The 13 s before t=0 are a real stretch of the same Minshawi recitation (source 23.64–36.64, ending where his pause ends) plus the real 0–2 s of the file.
- **Ring name «البيت», device name «الهاتف», the QR.** Illustrative. The QR is a real, scannable code for the demo payload `tilawa://ring/demo-7f3a`, which is not a real ring (`src/qr.js`).
- **Stream numbers.** 640 KB/s (HTTP) and 853 KB/s / 110 B/s (1 peer) are plausible figures from a real session, not a capture of this one. The downloaded bytes and the progress climb on a made-up schedule (300 KB at 23.0, +70 KB/s, capped at the 804 KB file size).
- **The timing.** The web seed starts after an 8 s wait with 0 peers in the app. The film compresses that: the stream sheet opens already on HTTP.
- **The «tilawah.cc» line.** Added so the film ends on an address. Remove it by deleting `#url` if you prefer the name alone.
- Page grain, cursor choreography, camera, motion blur (180° shutter averaged from three captures on frames where something moves more than 1.5 px).
- Flat tops in `waves`: the front layer clips at the top on loud passages. That is the app's own clamp (`Math.min(1, sample * auto * gain)`), kept as it is.

## 4. Gates (measured on the files)

- Frames: 630 and 960, 30 fps, audio length equals video length (21.000 s, 32.000 s).
- Loudness: −16.0 LUFS integrated on all four. True peak −1.5 dBFS (21 s) and −3.1 dBFS (32 s).
- No silence at the end: the last silence in the 32 s film ends at 19.56 s, and the voice runs to the last frame.
- Silences in the film are the recitation's real pauses (3.4–4.7 s, 8.7–10.0 s, 11.9–12.5 s, 14.5–15.1 s, 18.7–19.6 s).
- Not measured here: the human-motion band and cut-to-onset sync that the v1 gates reported (`look.py` is no longer in the repo).

## 5. What I would change next

- **The pairing beat is 2.5 s of QR.** If it reads as slow, shorten the countdown hold; if it reads as fast, move the join to 22.5.
- **Panel cuts do not land on sound onsets.** Deliberate, the voice runs across them.
- **mobile-intro (9:16) is not re-rendered.** It still uses the old ribbon and is documented as superseded in NOTE.md.
