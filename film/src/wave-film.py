#!/usr/bin/env python3
"""630 frames of the app's ribbon for the 16:9 film: V1 for 0-10.00 s,
V2 from 10.00 s. Writes window.WF = [ frame0, frame1, ... ] at 30 fps."""
import json
import subprocess

import numpy as np

WAVES = [dict(gain=2.6, follow=0.10, shift=0), dict(gain=2.1, follow=0.07, shift=37),
         dict(gain=1.7, follow=0.05, shift=83), dict(gain=1.35, follow=0.035, shift=131)]
FILL_GAIN, POINTS, WIN, TICK, SR = 0.65, 240, 1024, 1 / 15.0, 44100
FPS, FRAMES, SEAM = 30, 630, 300
V1_START, V2_START = 2.00, 16.18


def auto_gain(env):
    if not np.isfinite(env) or env < 0.02:
        return 1.0
    return max(1.0, min(3.0, 0.9 / max(env, 0.08)))


def trace(pcm, t):
    samples = [np.full(POINTS, 128.0) for _ in WAVES]
    env, auto, k = 0.0, 1.0, max(0.0, t - 2.0)
    idx = np.arange(POINTS)[None, :]
    while k <= t + 1e-9:
        end = int(k * SR)
        win = pcm[max(0, end - WIN):end]
        if len(win) < WIN:
            win = np.pad(win, (WIN - len(win), 0))
        raw = np.clip(np.round(win * 127.0 + 128.0), 0, 255)
        peak = float(np.max(np.abs(raw - 128.0)) / 128.0)
        env += (peak - env) * (0.25 if peak > env else 0.06)
        auto += (auto_gain(env) - auto) * 0.10
        for li, w in enumerate(WAVES):
            samples[li] += (raw[(idx + w['shift']) % WIN][0] - samples[li]) * w['follow']
        k += TICK
    return [np.round(np.power(np.minimum(1.0, np.abs((s - 128.0) / 128.0) * auto * w['gain'] * FILL_GAIN), 0.7), 3).tolist()
            for s, w in zip(samples, WAVES)]


def load(path):
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', path, '-ac', '1', '-ar', str(SR),
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0


def main():
    v1 = load('audio/m-norm.wav')
    v2 = load('audio/a-norm.wav')
    out = []
    for f in range(FRAMES):
        if f < SEAM:
            out.append(trace(v1, V1_START + f / FPS))
        else:
            out.append(trace(v2, V2_START + (f - SEAM) / FPS))
    with open('src/wave-film.js', 'w') as fh:
        fh.write('window.WF = ' + json.dumps(out, separators=(',', ':')) + ';\n')
    peaks = [max(fr[0]) for fr in out]
    print('frames', len(out), 'peak max', round(max(peaks), 3), 'at frame', peaks.index(max(peaks)))
    print('flat frames (<0.05):', sum(1 for p in peaks if p < 0.05))


if __name__ == '__main__':
    main()
