#!/usr/bin/env python3
"""Per-frame traces of the app's ribbon for the mobile preview.

Writes window.WMF = [ [layer0[240], layer1[240], layer2[240], layer3[240] ], ... ]
one entry per frame at 30 fps, starting at audio time --start.
"""
import argparse, json, subprocess
import numpy as np
import wave as wavelib  # noqa: F401  (kept for clarity of intent)

WAVES = [dict(gain=2.6, follow=0.10, shift=0), dict(gain=2.1, follow=0.07, shift=37),
         dict(gain=1.7, follow=0.05, shift=83), dict(gain=1.35, follow=0.035, shift=131)]
FILL_GAIN, POINTS, WIN, TICK, SR = 0.65, 240, 1024, 1 / 15.0, 44100


def auto_gain(env):
    if not np.isfinite(env) or env < 0.02:
        return 1.0
    return max(1.0, min(3.0, 0.9 / max(env, 0.08)))


def trace(pcm, t):
    start = max(0.0, t - 2.0)
    samples = [np.full(POINTS, 128.0) for _ in WAVES]
    env, auto, k = 0.0, 1.0, start
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
    out = []
    for li, w in enumerate(WAVES):
        v = np.minimum(1.0, np.abs((samples[li] - 128.0) / 128.0) * auto * w['gain'] * FILL_GAIN)
        out.append(np.round(np.power(v, 0.7), 3).tolist())
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--start', type=float, required=True)
    ap.add_argument('--frames', type=int, required=True)
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    raw = subprocess.run(['ffmpeg', '-v', 'quiet', '-i', a.audio, '-ac', '1', '-ar', str(SR),
                          '-f', 's16le', '-'], capture_output=True, check=True).stdout
    pcm = np.frombuffer(raw, dtype='<i2').astype(np.float32) / 32768.0
    frames = [trace(pcm, a.start + i / a.fps) for i in range(a.frames)]
    with open(a.out, 'w') as f:
        f.write('window.WMF = ' + json.dumps(frames, separators=(',', ':')) + ';\n')
    print('wrote', a.out, 'frames', len(frames), 'sound start', a.start)


if __name__ == '__main__':
    main()
