import { useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';

import { getPitchSource } from '@/utils/audio-analyser';
import {
  acceptFrame,
  findHolds,
  hzToMidi,
  INITIAL_JUMP,
  median3,
  midiToHz,
  shouldResetContour,
  type JumpState,
  type Sample,
} from '@/utils/pitch';

/**
 * The visible band: La2 to La4. A recitation sits roughly 100-400 Hz, and a
 * tighter window clips the top of a raised voice.
 */
const MIN_MIDI = 45;
const MAX_MIDI = 69;
/** Seconds of history to the left of the playhead. */
const WINDOW_SEC = 8;
const PLAYHEAD = 0.8;
const MIN_CLARITY = 0.88;
const SILENCE_RMS = 0.01;
/** A held sound shorter than this is a vowel, not a madd. */
const MADD_SEC = 0.35;
/** 30 Hz is plenty for a pitch line, and pitchy on 2048 samples is not free. */
const DATA_EVERY = 2;
/** Where the trace breaks: a gap longer than this is two phrases. */
const TRACE_GAP_SEC = 0.15;
const READOUT_MS = 120;
/** Hz marks on the axis: La2, Mi3, La3, Mi4, La4. */
const LABEL_MIDI = [45, 52, 57, 64, 69];

interface Tokens {
  surface: string;
  edge: string;
  grid: string;
  gold: string;
  dim: string;
  box: string;
}

/**
 * The reciter's melody, over time, with the madds marked.
 *
 * It owns no audio graph: the analyser and the element come from
 * `audio-analyser.ts`, which already tapped the one media source. The x axis is
 * `currentTime`, so a seek clears the buffer rather than drawing the new
 * position at the old time.
 */
export default function PitchContour({ playing }: { playing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const samplesRef = useRef<Sample[]>([]);
  /** Survives the effect re-running on pause, so the frozen contour stays put. */
  const nowRef = useRef(0);
  const [readout, setReadout] = useState<{ hz: number; cents: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const samples = samplesRef.current;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let tokens = readTokens();
    let width = 0;
    let height = 0;
    let raf = 0;
    let frame = 0;
    let now = nowRef.current;

    let detector: ReturnType<typeof PitchDetector.forFloat32Array> | null = null;
    let buffer: Float32Array<ArrayBuffer> | null = null;
    let element: HTMLAudioElement | null = null;
    let source: string | null = null;
    let lastMidi: number | null = null;
    let lastT = 0;
    let jump: JumpState = INITIAL_JUMP;
    let recent: number[] = [];
    let lastReadout = 0;

    const reset = () => {
      samples.length = 0;
      recent = [];
      lastMidi = null;
      jump = INITIAL_JUMP;
      setReadout(null);
    };

    const measure = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth || 320;
      height = canvas.clientHeight || 140;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const plotL = 58;
      const plotR = width - 10;
      const plotT = 30;
      const plotB = height - 6;
      const plotW = plotR - plotL;
      const plotH = plotB - plotT;
      const px = plotL + plotW * PLAYHEAD;
      const pps = (px - plotL) / WINDOW_SEC;
      const yOf = (midi: number) =>
        plotB - ((midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)) * plotH;
      const xOf = (t: number) => px - (now - t) * pps;

      ctx.clearRect(0, 0, width, height);

      // The instrument's face: its own surface, in both themes.
      ctx.fillStyle = tokens.surface;
      roundRect(ctx, 0, 0, width, height, 14);
      ctx.fill();
      ctx.strokeStyle = tokens.edge;
      ctx.lineWidth = 1;
      roundRect(ctx, 0.5, 0.5, width - 1, height - 1, 14);
      ctx.stroke();

      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = tokens.dim;
      ctx.fillText('الطبقات', plotR, 15);

      // Semitone grid; the naturals are the ones the eye needs to count by.
      ctx.font = '12px system-ui, sans-serif';
      // The page is RTL; a canvas inherits that and reorders "440 Hz".
      ctx.direction = 'ltr';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi += 1) {
        const natural = [0, 2, 4, 5, 7, 9, 11].includes(((midi % 12) + 12) % 12);
        const y = yOf(midi);
        ctx.strokeStyle = tokens.grid;
        ctx.globalAlpha = natural ? 0.55 : 0.25;
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(plotR, y);
        ctx.stroke();
        if (LABEL_MIDI.includes(midi)) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = tokens.dim;
          ctx.fillText(`${Math.round(midiToHz(midi))} Hz`, plotL - 6, y);
        }
      }
      ctx.globalAlpha = 1;

      const visible = samples.filter((sample) => sample.t >= now - WINDOW_SEC);

      // A madd: one box per continuous held sound. No count, no category —
      // the letters around it decide which madd it is, and the sound does not.
      for (const hold of findHolds(visible, MADD_SEC)) {
        const x1 = Math.max(plotL, xOf(hold.start));
        const x2 = Math.min(px, xOf(hold.end));
        if (x2 - x1 < 2) continue;
        const inside = visible.filter((s) => s.t >= hold.start && s.t <= hold.end && s.midi != null);
        const mean = inside.reduce((sum, s) => sum + (s.midi ?? 0), 0) / Math.max(1, inside.length);
        const y = yOf(mean);
        ctx.fillStyle = tokens.box;
        ctx.strokeStyle = tokens.box;
        ctx.globalAlpha = 0.12;
        roundRect(ctx, x1, y - 7, x2 - x1, 14, 4);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.lineWidth = 1;
        roundRect(ctx, x1, y - 7, x2 - x1, 14, 4);
        ctx.stroke();
      }

      // The trace, clipped to the plot, broken wherever there was no voice.
      ctx.save();
      ctx.beginPath();
      ctx.rect(plotL, plotT, plotW, plotH);
      ctx.clip();
      ctx.strokeStyle = tokens.gold;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      let open = false;
      let prevT = 0;
      ctx.beginPath();
      for (const sample of visible) {
        const voiced = sample.midi != null;
        if (!voiced || (open && sample.t - prevT > TRACE_GAP_SEC)) {
          open = false;
          if (!voiced) continue;
        }
        const y = yOf(Math.min(MAX_MIDI, Math.max(MIN_MIDI, sample.midi ?? 0)));
        if (!open) {
          ctx.moveTo(xOf(sample.t), y);
          open = true;
        } else {
          ctx.lineTo(xOf(sample.t), y);
        }
        prevT = sample.t;
      }
      ctx.stroke();
      ctx.restore();

      // Playhead, and a dot only while a voice is actually there.
      ctx.strokeStyle = tokens.gold;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, plotT);
      ctx.lineTo(px, plotB);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const last = samples[samples.length - 1];
      if (last && last.midi != null && now - last.t < 0.2) {
        ctx.fillStyle = tokens.gold;
        ctx.beginPath();
        ctx.arc(px, yOf(Math.min(MAX_MIDI, Math.max(MIN_MIDI, last.midi))), 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const analyse = () => {
      const found = getPitchSource();
      if (!found) return;
      const next = found.element;
      if (element !== next) {
        // A different element is a different recording; the first run is not a
        // change, so a pause/resume keeps the frozen contour.
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
      nowRef.current = now;
      // A jump in the clock means the samples belong to a position that is no
      // longer playing: a seek, or a new surah that starts at zero. The paused
      // case matters too — the seek happens with no frame loop running.
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

      let midi: number | null = null;
      if (rms >= SILENCE_RMS) {
        const [hz, clarity] = detector.findPitch(buffer, analyser.context.sampleRate);
        if (clarity >= MIN_CLARITY && hz > 40 && hz < 1200) {
          // A stale reference note is not evidence of a leap: after a quarter
          // second without pitch, the next note is accepted on its own.
          const fresh = lastMidi != null && now - lastT < 0.25;
          if (!fresh) jump = INITIAL_JUMP;
          const accepted = acceptFrame(hzToMidi(hz), fresh ? lastMidi : null, jump);
          jump = accepted.state;
          if (accepted.midi != null) {
            recent.push(accepted.midi);
            if (recent.length > 3) recent.shift();
            midi = recent.length === 3 ? median3(recent[0], recent[1], recent[2]) : accepted.midi;
            lastMidi = midi;
            lastT = now;
          }
        }
      }
      if (midi == null && (lastMidi == null || now - lastT > 0.25)) {
        recent = [];
        lastMidi = null;
      }
      // Outside the visible band is not a note at the edge: it is a voice the
      // panel cannot show, and a flat line there would read as data.
      if (midi != null && (midi < MIN_MIDI || midi > MAX_MIDI)) midi = null;

      samples.push({ t: now, midi, rms });
      while (samples.length && samples[0].t < now - WINDOW_SEC - 1) samples.shift();

      if (midi != null && performance.now() - lastReadout > READOUT_MS) {
        lastReadout = performance.now();
        setReadout({
          hz: midiToHz(midi),
          cents: Math.round((midi - Math.round(midi)) * 100),
        });
      }
    };

    function onSeek() {
      reset();
      draw();
    }

    const tick = () => {
      frame += 1;
      if (frame % DATA_EVERY === 0) analyse();
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

    // Reduced motion gets the axes and the readout, not a scrolling trace: the
    // spectrum makes the same call.
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

  return (
    <div className="flex h-full w-full flex-col">
      <canvas ref={canvasRef} aria-hidden="true" className="block h-full min-h-0 w-full flex-1" />
      <div className="flex h-[34px] shrink-0 items-center justify-center">
        <div
          dir="ltr"
          className="rounded-full border px-[18px] text-[0.75rem] leading-[22px] tabular-nums"
          style={{
            borderColor: 'var(--pitch-edge)',
            background: 'var(--pitch-surface)',
            color: 'var(--pitch-dim)',
          }}
        >
          {readout
            ? `${readout.hz.toFixed(1)} Hz · ${readout.cents > 0 ? '+' : ''}${readout.cents}¢`
            : '—'}
        </div>
      </div>
    </div>
  );
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
