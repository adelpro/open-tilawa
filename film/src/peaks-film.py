#!/usr/bin/env python3
"""630 frames of the app's `peaks` visualiser for the 16:9 film.

Faithful port of components/visualiser.tsx (drawPeaks) + utils/visualiser-models.ts
(downsample) on top of a Web Audio AnalyserNode (fftSize 1024, smoothing .75,
Blackman window, minDecibels -100 / maxDecibels -30), calibrated against a live
tone: a 0.5-amplitude 440 Hz sine reads -19.8 dB in its peak bin.

Writes window.WP = [ [ ...28 levels, ...28 peaks ], ... ] one entry per frame.
"""
import json
import subprocess

import numpy as np

SR, FPS, FRAMES, SEAM = 44100, 30, 630, 300
V1_START, V2_START = 2.00, 16.18
BARS, GAP = 28, 3
DATA_EVERY = 2                 # the app reads the analyser every other frame
SMOOTH = 0.75                  # smoothingTimeConstant
MIN_DB, MAX_DB = -100.0, -30.0

# Blackman window, periodic (what Chrome applies before the FFT)
N = 1024
_n = np.arange(N)
WINDOW = 0.42 - 0.5 * np.cos(2 * np.pi * _n / N) + 0.08 * np.cos(4 * np.pi * _n / N)


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR),
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0


def frequency_bytes(pcm, t, prev):
    end = int(t * SR)
    win = pcm[max(0, end - N):end]
    if len(win) < N:
        win = np.pad(win, (N - len(win), 0))
    mag = np.abs(np.fft.rfft(win * WINDOW)) / N            # 513 bins
    mag = SMOOTH * prev + (1 - SMOOTH) * mag               # AnalyserNode smoothing
    db = 20 * np.log10(np.maximum(mag, 1e-10))
    raw = np.clip(255 * (db - MIN_DB) / (MAX_DB - MIN_DB), 0, 255)
    return np.round(raw).astype(np.int32), mag


def downsample(bins):
    usable = int(len(bins) * 0.6)                          # 307
    out = []
    for i in range(BARS):
        start = int((i / BARS) ** 1.4 * usable)
        end = max(start + 1, int(((i + 1) / BARS) ** 1.4 * usable))
        out.append(float(np.max(bins[start:end])) / 255.0)
    return out


def run(pcm, start, frames):
    levels = [0.0] * BARS
    peaks = [0.0] * BARS
    mag = np.zeros(513)
    out = []
    for f in range(frames):
        if f % DATA_EVERY == 0:
            bins, mag = frequency_bytes(pcm, start + f / FPS, mag)
            target = downsample(bins)
            for i, level in enumerate(target):
                cur = levels[i]
                levels[i] += (level - cur) * (0.5 if level > cur else 0.14)
                peaks[i] = max(levels[i], peaks[i] - 0.008)
        out.append([round(v, 3) for v in levels] + [round(v, 4) for v in peaks])
    return out


def main():
    v1 = load('audio/m-norm.wav')
    v2 = load('audio/a-norm.wav')
    frames = run(v1, V1_START, SEAM) + run(v2, V2_START, FRAMES - SEAM)
    with open('src/peaks-film.js', 'w') as fh:
        fh.write('window.WP = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    hi = max(max(f[:BARS]) for f in frames)
    print('frames', len(frames), 'max level', round(hi, 3),
          'mean of max-per-frame', round(float(np.mean([max(f[:BARS]) for f in frames])), 3))


if __name__ == '__main__':
    main()
