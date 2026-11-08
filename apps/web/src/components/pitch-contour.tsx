import { useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';

import { getPitchSource } from '@/utils/audio-analyser';
import { useLocale } from '@/hooks/use-locale';
import {
  acceptFrame,
  countReversals,
  findSegments,
  hzToMidi,
  INITIAL_JUMP,
  midiToHz,
  midiToName,
  percentile,
  shouldResetContour,
  type JumpState,
  type Sample,
} from '@/utils/pitch';

/** The visible band: La#2 to Do#4, where a recitation actually lives. */
const MIN_MIDI = 46;
const MAX_MIDI = 61;
/** Seconds of history to the left of the playhead. */
const WINDOW_SEC = 6.5;
const PLAYHEAD = 0.6;
const MIN_CLARITY = 0.88;
const SILENCE_RMS = 0.01;
/** A stable stretch shorter than this is a vowel, not a madd. */
const SUSTAIN_SEC = 0.45;
const READOUT_MS = 150;
const DOT_RADIUS = 11;

interface Box {
  start: number;
  end: number;
  lo: number;
  hi: number;
  kind: 'madd' | 'ghurba';
}

export interface PitchStats {
  hz: number | null;
  note: string | null;
  cents: number | null;
  db: number | null;
  /** Lowest note so far (3rd percentile, so a single glitch is ignored). */
  lowest: string | null;
  /** Pitch range in octaves (3rd to 97th percentile). */
  rangeOct: number;
  pauses: number;
  /** Sustained flat notes. */
  madds: number;
  /** Wandering excursions between neighbouring notes. */
  ghurab: number;
}

interface Tokens {
  surface: string;
  edge: string;
  grid: string;
  gold: string;
  dim: string;
  box: string;
  soft: string;
  mute: string;
}

const EMPTY: PitchStats = {
  hz: null,
  note: null,
  cents: null,
  db: null,
  lowest: null,
  rangeOct: 0,
  pauses: 0,
  madds: 0,
  ghurab: 0,
};

/**
 * The reciter's melody, over time, with the madds marked.
 *
 * It owns no audio graph: the analyser and the element come from
 * `audio-analyser.ts`, which already tapped the one media source.
 */
export default function PitchContour({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stats, setStats] = useState<PitchStats>(EMPTY);
  const { t } = useLocale();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let tokens = readTokens();
    let width = 0;
    let height = 0;
    let raf = 0;
    let frame = 0;
    let now = 0;

    // ---- analysis state ----
    let samples: Sample[] = [];
    let run: Sample[] = [];
    let boxes: Box[] = [];
    let voiced: number[] = [];
    let recent: number[] = [];
    let lastMidi: number | null = null;
    let lastT = 0;
    let peak = 0;
    let loud = 0;
    let jump: JumpState = INITIAL_JUMP;
    let quietStart: number | null = null;
    let seenVoice = false;
    let pauses = 0;
    let madds = 0;
    let ghurab = 0;
    let lastDb: number | null = null;
    let lastEmit = 0;
    let voicedTick = 0;

    let detector: ReturnType<typeof PitchDetector.forFloat32Array> | null = null;
    let buffer: Float32Array<ArrayBuffer> | null = null;
    let element: HTMLAudioElement | null = null;
    let source: string | null = null;

    const reset = () => {
      samples = [];
      run = [];
      boxes = [];
      voiced = [];
      recent = [];
      lastMidi = null;
      peak = 0;
      loud = 0;
      jump = INITIAL_JUMP;
      quietStart = null;
      seenVoice = false;
      pauses = 0;
      madds = 0;
      ghurab = 0;
      lastDb = null;
      setStats(EMPTY);
    };

    const finalizeRun = () => {
      if (run.length < 8) {
        run = [];
        return;
      }
      const dur = run[run.length - 1].t - run[0].t;
      const segments = findSegments(run, SUSTAIN_SEC);
      if (segments.length) {
        for (const segment of segments) {
          boxes.push({
            start: segment.start,
            end: segment.end,
            lo: segment.midi,
            hi: segment.midi,
            kind: 'madd',
          });
          madds += 1;
        }
      } else if (dur >= 0.35 && dur <= 3) {
        const ms = run.map((sample) => sample.midi).filter((m): m is number => m != null);
        if (ms.length > 3) {
          const sorted = [...ms].sort((a, b) => a - b);
          const lo = percentile(sorted, 0.05);
          const hi = percentile(sorted, 0.95);
          if (hi - lo >= 1.5 && countReversals(ms) >= 3) {
            boxes.push({
              start: run[0].t,
              end: run[run.length - 1].t,
              lo,
              hi,
              kind: 'ghurba',
            });
            ghurab += 1;
          }
        }
      }
      run = [];
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || 320;
      height = canvas.clientHeight || 160;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const padL = 56;
      const padR = 14;
      const padT = 12;
      const ampH = 30;
      const gap = 8;
      const plotL = padL;
      const plotR = width - padR;
      const plotT = padT;
      const ampB = height - 8;
      const ampT = ampB - ampH;
      const plotB = ampT - gap;
      const plotW = plotR - plotL;
      const px = plotL + plotW * PLAYHEAD;
      const pps = (px - plotL) / WINDOW_SEC;
      const clampM = (m: number) => Math.min(MAX_MIDI, Math.max(MIN_MIDI, m));
      const yOf = (m: number) => plotB - ((m - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)) * (plotB - plotT);
      const xOf = (t: number) => px - (now - t) * pps;

      ctx.clearRect(0, 0, width, height);

      // The instrument's face: its own surface, in both themes.
      ctx.fillStyle = tokens.surface;
      roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 16);
      ctx.fill();
      ctx.strokeStyle = tokens.edge;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Dotted quarter-tone grid and the note axis.
      ctx.direction = 'ltr';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let m = Math.ceil(MIN_MIDI * 2) / 2; m <= MAX_MIDI; m += 0.5) {
        const whole = Number.isInteger(m);
        const y = yOf(m);
        ctx.setLineDash([2, 3]);
        ctx.strokeStyle = tokens.grid;
        ctx.globalAlpha = whole ? 0.55 : 0.25;
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(plotR, y);
        ctx.stroke();
        ctx.setLineDash([]);
        if (whole) {
          const natural = !midiToName(m).includes('#');
          ctx.globalAlpha = 1;
          ctx.fillStyle = natural ? tokens.soft : tokens.mute;
          ctx.fillText(midiToName(m), plotL - 8, y);
        }
      }
      ctx.globalAlpha = 1;

      const visible = samples.filter((sample) => sample.t >= now - WINDOW_SEC - 0.2);

      // Madds and ghurbas: finalized boxes plus the one still growing.
      const live = run.length > 1 ? findSegments(run, SUSTAIN_SEC) : [];
      const all: Box[] = [
        ...boxes,
        ...live.map((s) => ({ start: s.start, end: s.end, lo: s.midi, hi: s.midi, kind: 'madd' as const })),
      ];
      for (const b of all) {
        const x1 = Math.max(xOf(b.start) - 4, plotL);
        const x2 = xOf(b.end) + 4;
        if (x2 < plotL) continue;
        const pad = b.kind === 'madd' ? 7 : 8;
        const y1 = yOf(clampM(b.hi)) - pad;
        const y2 = yOf(clampM(b.lo)) + pad;
        roundRect(ctx, x1, y1, Math.max(2, x2 - x1), y2 - y1, 5);
        ctx.fillStyle = b.kind === 'madd' ? tokens.box : tokens.gold;
        ctx.globalAlpha = b.kind === 'madd' ? 0.1 : 0.07;
        ctx.fill();
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = b.kind === 'madd' ? tokens.box : tokens.dim;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // The trace, coloured by loudness: gold when the voice is strong, pale
      // when it is soft, with a gap wherever there was no voice.
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotL, plotT, plotW, plotB - plotT + 6);
      ctx.clip();
      ctx.lineWidth = 2.4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let prev: Sample | null = null;
      let started = false;
      const flush = () => {
        if (started) ctx.stroke();
        started = false;
      };
      for (const sample of visible) {
        if (sample.midi == null) {
          flush();
          prev = null;
          continue;
        }
        const x = xOf(sample.t);
        const y = yOf(clampM(sample.midi));
        const colour = sample.strong ? tokens.gold : tokens.soft;
        if (!prev || sample.t - prev.t > 0.15) {
          flush();
          ctx.beginPath();
          ctx.moveTo(x, y);
          started = true;
          ctx.strokeStyle = colour;
          ctx.shadowColor = sample.strong ? tokens.gold : 'transparent';
          ctx.shadowBlur = sample.strong ? 5 : 0;
        } else if (colour !== ctx.strokeStyle) {
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = colour;
          ctx.shadowColor = sample.strong ? tokens.gold : 'transparent';
          ctx.shadowBlur = sample.strong ? 5 : 0;
        } else {
          ctx.lineTo(x, y);
        }
        prev = sample;
      }
      flush();
      ctx.restore();
      ctx.shadowBlur = 0;

      // The amplitude envelope: grey history, gold for the last 0.8 s.
      if (visible.length > 1) {
        const norm = (r: number) => 0.3 + 0.7 * Math.min(1, Math.pow(r / Math.max(peak, 1e-4), 0.6));
        const fillArea = (from: number, to: number, colour: string) => {
          ctx.beginPath();
          let open = false;
          let lastX = from;
          for (const sample of visible) {
            const x = xOf(sample.t);
            if (x < from || x > to) continue;
            const y = ampB - norm(sample.rms) * ampH;
            if (!open) {
              ctx.moveTo(x, ampB);
              ctx.lineTo(x, y);
              open = true;
            } else {
              ctx.lineTo(x, y);
            }
            lastX = x;
          }
          if (open) {
            ctx.lineTo(lastX, ampB);
            ctx.closePath();
            ctx.fillStyle = colour;
            ctx.fill();
          }
        };
        const split = px - 0.8 * pps;
        fillArea(plotL, split, 'rgba(150,152,165,0.85)');
        fillArea(split - 1, px, tokens.gold);
      }

      // Playhead and the glowing dot.
      ctx.strokeStyle = tokens.gold;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, plotT);
      ctx.lineTo(px, ampB);
      ctx.stroke();
      const last = samples[samples.length - 1];
      if (last && last.midi != null && now - last.t < 0.2) {
        const y = yOf(clampM(last.midi));
        const glow = DOT_RADIUS * 2.6;
        const gradient = ctx.createRadialGradient(px, y, 0, px, y, glow);
        gradient.addColorStop(0, withAlpha(tokens.gold, 0.95));
        gradient.addColorStop(1, withAlpha(tokens.gold, 0));
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, y, glow, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffe9a0';
        ctx.beginPath();
        ctx.arc(px, y, DOT_RADIUS, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const analyse = () => {
      const found = getPitchSource();
      if (!found) return;
      const next = found.element;
      if (element !== next) {
        if (element != null) reset();
        element = next;
        source = next.currentSrc;
        element.addEventListener('seeking', onSeek);
        element.addEventListener('ended', onSeek);
      }
      if (source !== element.currentSrc) {
        source = element.currentSrc;
        reset();
      }
      now = element.currentTime;
      const newest = samples[samples.length - 1];
      if (newest && shouldResetContour(newest.t, now)) reset();
      if (element.paused || element.ended) return;

      const { analyser } = found;
      if (!detector || !buffer || buffer.length !== analyser.fftSize) {
        detector = PitchDetector.forFloat32Array(analyser.fftSize);
        buffer = new Float32Array(analyser.fftSize);
      }
      analyser.getFloatTimeDomainData(buffer);

      let sum = 0;
      for (let i = 0; i < buffer.length; i += 1) sum += buffer[i] * buffer[i];
      const rms = Math.sqrt(sum / buffer.length);
      lastDb = Math.round(20 * Math.log10(Math.max(rms, 1e-5)));
      peak = Math.max(rms, peak * 0.9995);
      loud += (rms - loud) * 0.25;
      const quietThr = Math.max(SILENCE_RMS, peak * 0.1);

      let midi: number | null = null;
      if (rms >= Math.max(SILENCE_RMS, peak * 0.12)) {
        const [hz, clarity] = detector.findPitch(buffer, analyser.context.sampleRate);
        if (clarity >= MIN_CLARITY && hz > 40 && hz < 1200) {
          const raw = hzToMidi(hz);
          const fresh = lastMidi != null && now - lastT < 0.25;
          if (!fresh) jump = INITIAL_JUMP;
          const accepted = acceptFrame(raw, fresh ? lastMidi : null, jump);
          jump = accepted.state;
          if (accepted.midi != null) {
            recent.push(accepted.midi);
            if (recent.length > 5) recent.shift();
            midi =
              recent.length === 5
                ? [...recent].sort((a, b) => a - b)[2]
                : accepted.midi;
            lastMidi = midi;
            lastT = now;
          }
        }
      }
      if (midi == null && (lastMidi == null || now - lastT > 0.25)) {
        recent = [];
        lastMidi = null;
      }
      if (midi != null && (midi < MIN_MIDI || midi > MAX_MIDI)) midi = null;

      const sample: Sample = { t: now, midi, rms, strong: loud >= peak * 0.45 };
      samples.push(sample);
      while (samples.length && samples[0].t < now - WINDOW_SEC - 1) samples.shift();

      // A pause is a quiet stretch between two voiced ones.
      if (rms < quietThr) {
        if (quietStart == null && seenVoice) quietStart = now;
      }
      if (midi != null) {
        if (quietStart != null && now - quietStart >= 0.35) pauses += 1;
        quietStart = null;
        seenVoice = true;
        if (run.length && now - run[run.length - 1].t > 0.15) finalizeRun();
        run.push(sample);
        voicedTick += 1;
        if (voicedTick % 2 === 0) {
          voiced.push(midi);
          if (voiced.length > 6000) voiced.shift();
        }
      } else if (run.length && now - run[run.length - 1].t > 0.15) {
        finalizeRun();
      }
      boxes = boxes.filter((box) => box.end > now - WINDOW_SEC - 1);

      if (performance.now() - lastEmit > READOUT_MS) {
        lastEmit = performance.now();
        let lowest: string | null = null;
        let rangeOct = 0;
        if (voiced.length > 20) {
          const sorted = [...voiced].sort((a, b) => a - b);
          const p3 = percentile(sorted, 0.03);
          const p97 = percentile(sorted, 0.97);
          lowest = midiToName(p3);
          rangeOct = (p97 - p3) / 12;
        }
        const live = lastMidi != null && now - lastT < 0.2 ? lastMidi : null;
        setStats({
          hz: live != null ? midiToHz(live) : null,
          note: live != null ? midiToName(live) : null,
          cents: live != null ? Math.round((live - Math.round(live)) * 100) : null,
          db: lastDb,
          lowest,
          rangeOct,
          pauses,
          madds,
          ghurab,
        });
      }
    };

    function onSeek() {
      reset();
      draw();
    }

    const tick = () => {
      frame += 1;
      if (frame % 2 === 0) analyse();
      draw();
      raf = requestAnimationFrame(tick);
    };

    measure();
    draw();

    const observer = new ResizeObserver(() => {
      measure();
      draw();
    });
    observer.observe(canvas);

    const theme = new MutationObserver(() => {
      tokens = readTokens();
      draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    if (playing && !reduced) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      theme.disconnect();
      if (element) {
        element.removeEventListener('seeking', onSeek);
        element.removeEventListener('ended', onSeek);
      }
    };
  }, [playing]);

  const live = stats.hz != null && stats.note != null && stats.cents != null;
  return (
    <div className="flex h-full w-full flex-col">
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full min-h-0 w-full flex-1" />
      <div className="mt-1 flex h-[30px] shrink-0 items-center justify-center">
        <div
          dir="ltr"
          className="rounded-full border px-[18px] text-[0.75rem] leading-[22px] tabular-nums"
          style={{
            borderColor: 'var(--pitch-edge)',
            background: 'var(--pitch-surface)',
            color: 'var(--pitch-soft)',
          }}
        >
          {live
            ? `${stats.hz!.toFixed(1)} Hz · ${stats.note} · ${stats.cents! > 0 ? '+' : ''}${stats.cents}¢ · ${stats.db ?? 0} dB`
            : '— · — · — · — dB'}
        </div>
      </div>
      <div className="mt-1 flex h-[30px] shrink-0 items-center justify-center">
        <div
          className="flex items-center gap-3 rounded-lg border px-3 text-[0.75rem]"
          style={{
            borderColor: 'var(--pitch-edge)',
            background: 'var(--pitch-surface)',
            color: 'var(--pitch-dim)',
          }}
        >
          <span>{t.pitch.lowest}</span>
          <span dir="ltr" className="font-semibold tabular-nums" style={{ color: 'var(--pitch-soft)' }}>
            {stats.lowest ?? '—'}
          </span>
        </div>
      </div>
      <div dir="ltr" className="mt-1 grid h-[52px] shrink-0 grid-cols-4 gap-1">
        <Chip label={t.pitch.range} value={stats.rangeOct.toFixed(1)} />
        <Chip label={t.pitch.pauses} value={String(stats.pauses)} />
        <Chip label={t.pitch.madds} value={String(stats.madds)} />
        <Chip label={t.pitch.ghurab} value={String(stats.ghurab)} />
      </div>
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-lg border"
      style={{ borderColor: 'var(--pitch-edge)', background: 'var(--pitch-surface)' }}
    >
      <span className="text-[0.875rem] font-semibold tabular-nums" style={{ color: 'var(--pitch-soft)' }}>
        {value}
      </span>
      <span className="text-[0.6875rem]" style={{ color: 'var(--pitch-dim)' }}>
        {label}
      </span>
    </div>
  );
}

/** Hex token to rgba, so the glow follows the palette instead of copying it. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.trim();
  if (!value.startsWith('#')) return value;
  const full = value.length === 4 ? value.slice(1).split('').map((c) => c + c).join('') : value.slice(1);
  if (full.length !== 6) return value;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function readTokens(): Tokens {
  const styles = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    surface: pick('--pitch-surface', '#0a1226'),
    edge: pick('--pitch-edge', '#1c2a52'),
    grid: pick('--pitch-grid', '#243464'),
    gold: pick('--pitch-gold', '#f5c518'),
    dim: pick('--pitch-dim', '#8d7a2a'),
    box: pick('--pitch-box', '#5b7cff'),
    soft: pick('--pitch-soft', '#dfe4f2'),
    mute: pick('--pitch-mute', '#4b5886'),
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
