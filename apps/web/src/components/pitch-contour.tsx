import { useEffect, useRef, useState } from 'react';
import { PitchDetector } from 'pitchy';

import { getPitchSource } from '@/utils/audio-analyser';
import {
  acceptFrame,
  findHolds,
  hzToMidi,
  INITIAL_JUMP,
  median3,
  midiToName,
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

interface Tokens {
  front: string;
  back: string;
  line: string;
  ink: string;
  muted: string;
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
  const [readout, setReadout] = useState<{ note: string; cents: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const samples = samplesRef.current;
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
      const plotL = 46;
      const plotR = width - 10;
      const plotT = 8;
      const plotB = height - 6;
      const plotW = plotR - plotL;
      const plotH = plotB - plotT;
      const px = plotL + plotW * PLAYHEAD;
      const pps = (px - plotL) / WINDOW_SEC;
      const yOf = (midi: number) =>
        plotB - ((midi - MIN_MIDI) / (MAX_MIDI - MIN_MIDI)) * plotH;
      const xOf = (t: number) => px - (now - t) * pps;

      ctx.clearRect(0, 0, width, height);

      // Semitone grid; the naturals are the ones the eye needs to count by.
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi += 1) {
        const name = midiToName(midi);
        const natural = !name.includes('♯');
        const y = yOf(midi);
        ctx.strokeStyle = tokens.line;
        ctx.globalAlpha = natural ? 0.1 : 0.05;
        ctx.beginPath();
        ctx.moveTo(plotL, y);
        ctx.lineTo(plotR, y);
        ctx.stroke();
        if (midi % 12 === 0 || midi % 12 === 7) {
          ctx.globalAlpha = 1;
          ctx.fillStyle = tokens.muted;
          ctx.fillText(name, plotL - 6, y);
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
        ctx.fillStyle = tokens.front;
        ctx.strokeStyle = tokens.line;
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
      ctx.strokeStyle = tokens.back;
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
      ctx.strokeStyle = tokens.ink;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, plotT);
      ctx.lineTo(px, plotB);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const last = samples[samples.length - 1];
      if (last && last.midi != null && now - last.t < 0.2) {
        ctx.fillStyle = tokens.front;
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

      samples.push({ t: now, midi, rms });
      while (samples.length && samples[0].t < now - WINDOW_SEC - 1) samples.shift();

      if (midi != null && performance.now() - lastReadout > READOUT_MS) {
        lastReadout = performance.now();
        setReadout({
          note: midiToName(midi),
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

    if (playing) raf = requestAnimationFrame(tick);

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
      <div className="h-[22px] shrink-0 text-center text-[0.75rem] leading-[22px] text-muted tabular-nums">
        {readout ? `${readout.note} · ${readout.cents > 0 ? '+' : ''}${readout.cents}¢` : '—'}
      </div>
    </div>
  );
}

function readTokens(): Tokens {
  const styles = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback;
  return {
    front: pick('--wave-front', '#1c4d78'),
    back: pick('--wave-back', '#5d97c9'),
    line: pick('--line', '#e8e8e8'),
    ink: pick('--ink', '#111'),
    muted: pick('--muted', '#666'),
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
