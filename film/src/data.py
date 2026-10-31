#!/usr/bin/env python3
"""Spectrum data for the launch film, one script for both shapes and both cuts.

    python3 src/data.py            # writes peaks-film.js, peaks-32.js, ribbon-21.js, ribbon-32.js

Run from `film/`. Inputs are the loudness-matched recitations in `audio/`
(`m-norm.wav` = Minshawi, `a-norm.wav` = Hussary), the same signal the viewer hears.

BARS (`peaks`): a port of visualiser.tsx `drawPeaks` + visualiser-models.ts
`downsample` on a Web Audio AnalyserNode (fftSize 1024, smoothing 0.75, Blackman
window, -100/-30 dB), calibrated against a live Chrome analyser. One entry per
film frame: 28 levels, then 28 peak caps. Writes `window.WP`.

WAVES (`ribbon`): a port of the CURRENT app ribbon (visualiser.tsx after PR #1):
a loudness history that scrolls left, newest point at the right edge.
  - the analyser is read every 2nd frame at 60 Hz = 30 Hz; each read takes the peak
    magnitude of the last 1024 samples (`peakMagnitude`);
  - one envelope (attack .25 / release .06) feeds `autoGain`, smoothed by .1;
  - every PUSH_MS (60 ms) one point is pushed per layer: the layer's accumulator
    follows the loudest read since the last push, rising and falling at its own rate.
Only the pushed values and the per-read gain are stored; the page rebuilds the
history and the scroll phase for any time `t`. Writes `window.WV`.

The strip is a history, so at t=0 it must already be full: the film starts mid
recitation. The 15 s before t=0 are real for the 2 s the file has, and before that
a stretch of the same recitation that ends in a pause (see PRE_FROM). Declared in
NOTE.md as built.
"""
import json
import subprocess
import sys

import numpy as np

SR, FPS = 44100, 30
BARS = 28
DATA_EVERY = 2
SMOOTH = 0.75
MIN_DB, MAX_DB = -100.0, -30.0
N = 1024
_n = np.arange(N)
WINDOW = 0.42 - 0.5 * np.cos(2 * np.pi * _n / N) + 0.08 * np.cos(4 * np.pi * _n / N)

# the ribbon, constants copied from apps/web/src/components/visualiser.tsx
WAVES = [(0.7, 0.35), (0.45, 0.2), (0.28, 0.12), (0.18, 0.07)]   # (rise, fall) per push
PUSH_S = 0.060
POINTS = 240
ATTACK, RELEASE, AUTO_SMOOTH = 0.25, 0.06, 0.10

V1_START = 2.00
SEAM = 10.0
CUTS = {
    # name: (duration s, Hussary source start s, frames)
    '21': (21.0, 16.18),
    '32': (32.0, 11.05),   # an onset, so the voice runs unbroken to the last frame
}
PRE = 15.0
PRE_FROM = (23.64, 36.64)  # Minshawi, ends where his pause 35.58-36.64 ends


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR),
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0


def seg(pcm, a, b):
    return pcm[int(round(a * SR)):int(round(b * SR))]


# ---------- bars ----------
def frequency_bytes(pcm, t, prev):
    end = int(t * SR)
    win = pcm[max(0, end - N):end]
    if len(win) < N:
        win = np.pad(win, (N - len(win), 0))
    mag = np.abs(np.fft.rfft(win * WINDOW)) / N
    mag = SMOOTH * prev + (1 - SMOOTH) * mag
    db = 20 * np.log10(np.maximum(mag, 1e-10))
    raw = np.clip(255 * (db - MIN_DB) / (MAX_DB - MIN_DB), 0, 255)
    return np.round(raw).astype(np.int32), mag


def downsample(bins):
    usable = int(len(bins) * 0.6)
    out = []
    for i in range(BARS):
        start = int((i / BARS) ** 1.4 * usable)
        end = max(start + 1, int(((i + 1) / BARS) ** 1.4 * usable))
        out.append(float(np.max(bins[start:end])) / 255.0)
    return out


def peaks_run(pcm, start, frames):
    levels, peaks, mag, out = [0.0] * BARS, [0.0] * BARS, np.zeros(513), []
    for f in range(frames):
        if f % DATA_EVERY == 0:
            bins, mag = frequency_bytes(pcm, start + f / FPS, mag)
            for i, level in enumerate(downsample(bins)):
                cur = levels[i]
                levels[i] += (level - cur) * (0.5 if level > cur else 0.14)
                peaks[i] = max(levels[i], peaks[i] - 0.008)
        out.append([round(v, 3) for v in levels] + [round(v, 4) for v in peaks])
    return out


def write_peaks(name, m, a, dur, v2):
    frames = int(round(dur * FPS))
    seam = int(round(SEAM * FPS))
    data = peaks_run(m, V1_START, seam) + peaks_run(a, v2, frames - seam)
    with open(f'src/{name}', 'w') as fh:
        fh.write('window.WP = ' + json.dumps(data, separators=(',', ':')) + ';\n')
    print(name, 'frames', len(data))


# ---------- ribbon ----------
def auto_gain(env):
    if not np.isfinite(env) or env < 0.02:
        return 1.0
    return max(1.0, min(3.0, 0.9 / max(env, 0.08)))


def write_ribbon(name, m, a, dur, v2):
    # film time of pcm[0] is -PRE
    pre_len = PRE - V1_START
    pcm = np.concatenate([
        seg(m, PRE_FROM[1] - pre_len, PRE_FROM[1]),
        seg(m, 0.0, SEAM + V1_START),
        seg(a, v2, v2 + (dur - SEAM)),
    ])
    t0 = -PRE
    envelope, auto = 0.0, 1.0
    acc = [0.0] * len(WAVES)
    k0 = int(np.floor((0 - (POINTS + 1) * PUSH_S) / PUSH_S))
    k_end = int(np.ceil(dur / PUSH_S)) + 2
    pushes = [[] for _ in WAVES]
    autos = []
    running, k = 0.0, int(np.floor(t0 / PUSH_S)) + 1
    j = int(np.ceil((t0 + N / SR) * FPS))
    t_read = j / FPS
    while k <= k_end:
        # reads up to the next push time
        t_push = k * PUSH_S
        while t_read <= t_push + 1e-9:
            end = int(round((t_read - t0) * SR))
            win = pcm[max(0, end - N):end]
            if len(win) < N:
                win = np.pad(win, (N - len(win), 0))
            raw = np.clip(np.round(win * 127.0 + 128.0), 0, 255)
            peak = float(np.max(np.abs(raw - 128.0)) / 128.0)
            running = max(running, peak)
            envelope += (peak - envelope) * (ATTACK if peak > envelope else RELEASE)
            auto += (auto_gain(envelope) - auto) * AUTO_SMOOTH
            if t_read >= 0:
                autos.append(round(auto, 4))
            j += 1
            t_read = j / FPS
        for li, (rise, fall) in enumerate(WAVES):
            acc[li] += (running - acc[li]) * (rise if running > acc[li] else fall)
            if k >= k0:
                pushes[li].append(round(acc[li], 4))
        running = 0.0
        k += 1
    obj = {'push_s': PUSH_S, 'k0': k0, 'push': pushes, 'auto': autos, 'fps': FPS}
    with open(f'src/{name}', 'w') as fh:
        fh.write('window.WV = ' + json.dumps(obj, separators=(',', ':')) + ';\n')
    print(name, 'pushes', len(pushes[0]), 'reads', len(autos),
          'max push', round(max(max(p) for p in pushes), 3),
          'mean auto', round(float(np.mean(autos)), 2))


def main():
    m, a = load('audio/m-norm.wav'), load('audio/a-norm.wav')
    print('m-norm', round(len(m) / SR, 2), 's, a-norm', round(len(a) / SR, 2), 's')
    which = sys.argv[1:] or ['peaks', 'ribbon']
    for cut, (dur, v2) in CUTS.items():
        if 'peaks' in which:
            write_peaks('peaks-film.js' if cut == '21' else 'peaks-32.js', m, a, dur, v2)
        if 'ribbon' in which:
            write_ribbon(f'ribbon-{cut}.js', m, a, dur, v2)


if __name__ == '__main__':
    main()
