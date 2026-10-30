#!/usr/bin/env python3
"""Render the app's real ribbon algorithm (components/visualiser.tsx) for given
audio times, so the film/screens draw the actual shape of the recitation.

Usage: python3 wave.py --audio a.mp3 --times 0.6,2.85 --out wave.json
"""
import argparse, json, subprocess, sys
import numpy as np

WAVES = [dict(gain=2.6, follow=0.10, shift=0), dict(gain=2.1, follow=0.07, shift=37),
         dict(gain=1.7, follow=0.05, shift=83), dict(gain=1.35, follow=0.035, shift=131)]
FILL_GAIN, POINTS, WIN, TICK = 0.65, 240, 1024, 1/15.0


def auto_gain(env):
    if not np.isfinite(env) or env < 0.02:
        return 1.0
    return max(1.0, min(3.0, 0.9 / max(env, 0.08)))


def trace(pcm, t):
    """Steady-state 4x240 traces at audio time t (seconds)."""
    sr = 44100
    start = max(0.0, t - 2.0)
    samples = [np.full(POINTS, 128.0) for _ in WAVES]
    env, auto = 0.0, 1.0
    k = start
    while k <= t + 1e-9:
        end = int(k * sr)
        win = pcm[max(0, end - WIN):end]
        if len(win) < WIN:
            win = np.pad(win, (WIN - len(win), 0))
        raw = np.clip(np.round(win * 127.0 + 128.0), 0, 255)
        peak = float(np.max(np.abs(raw - 128.0)) / 128.0)
        env += (peak - env) * (0.25 if peak > env else 0.06)
        auto += (auto_gain(env) - auto) * 0.10
        idx = (np.arange(POINTS) + 0)[None, :]
        for li, w in enumerate(WAVES):
            shifted = raw[(idx + w['shift']) % WIN][0]
            samples[li] += (shifted - samples[li]) * w['follow']
        k += TICK
    out = []
    for li, w in enumerate(WAVES):
        v = np.minimum(1.0, np.abs((samples[li] - 128.0) / 128.0) * auto * w['gain'] * FILL_GAIN)
        out.append([round(float(x), 5) for x in np.power(v, 0.7)])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--times', required=True)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', a.audio, '-ac', '1', '-ar', '44100',
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
    data = {t: trace(pcm, float(t)) for t in a.times.split(',')}
    with open(a.out, 'w') as f:
        json.dump(dict(points=POINTS, waves=data), f)
    print('wrote', a.out, 'times', list(data), 'peak', max(max(w[0]) for w in data.values()))


if __name__ == '__main__':
    main()
