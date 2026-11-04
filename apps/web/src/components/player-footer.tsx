import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons';
import StreamSourceIcon from '@/components/stream-source-icon';
import { useLocale } from '@/hooks/use-locale';
import type { StreamSource } from '@/utils/stream-source';
import { cn } from '@/utils/cn';

/** A hold shorter than this is a tap that opened the gauge. */
const LONG_PRESS_MS = 500;

/**
 * The mini-player: the surah is the title (tap for the list), the reciter is the
 * artist (tap for the roster), and the stream state sits at the far end, where
 * nothing important can be hit by accident.
 *
 * The speaker is two controls in one: a tap opens the level gauge (0 is mute),
 * a hold mutes immediately. The gauge is a popover rather than a second row, so
 * the footer keeps its thumb-sized height on a phone.
 */
export default function PlayerFooter({
  surahName,
  reciterName,
  source,
  progress = 0,
  rate = 1,
  onOpenSurahs,
  onOpenReciters,
  onOpenStream,
  onOpenRate,
  volume,
  onVolume,
  onToggleMute,
  onToggleFullscreen,
}: {
  surahName: string;
  reciterName: string;
  source: StreamSource;
  /** 0–1 of the torrent this session has; drives the ring, never a second badge. */
  progress?: number;
  /** Shown only when it deviates from 1x, so the default bar stays two labels. */
  rate?: number;
  onOpenRate: () => void;
  /** 0–1. Zero is the mute state everywhere in this component. */
  volume: number;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
  onOpenSurahs: () => void;
  onOpenReciters: () => void;
  onOpenStream: () => void;
}) {
  const { t } = useLocale();
  const sourceLabel: Record<StreamSource, string> = {
    connected: t.source.connected,
    waiting: t.source.waiting,
    webseed: t.source.webseed,
    mixed: t.source.mixed,
  };
  const hasProgress = progress > 0.005;
  const percent = Math.round(progress * 100);
  const ring = 2 * Math.PI * 20;

  const muted = volume === 0;
  const level = Math.round(volume * 100);

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const holdRef = useRef<number | null>(null);
  const firedRef = useRef(false);

  const clearHold = () => {
    if (holdRef.current !== null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };

  useEffect(() => clearHold, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  /**
   * A hold must not leave a click behind: the timer fires the mute, and the
   * click that follows the release is swallowed once. A pointer that leaves or
   * is cancelled before the timer is a scroll, not a hold.
   */
  const startHold = () => {
    clearHold();
    firedRef.current = false;
    holdRef.current = window.setTimeout(() => {
      holdRef.current = null;
      firedRef.current = true;
      onToggleMute();
      navigator.vibrate?.(10);
    }, LONG_PRESS_MS);
  };

  const endHold = () => {
    clearHold();
  };

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <footer className="theatre-footer shrink-0 border-t border-line pb-[env(safe-area-inset-bottom)]">
      {/* Same 16px gutter as the top bar: the ring should sit as far from the
          edge as the mark does, or it reads as pushed to the corner. */}
      <div className="mx-auto flex min-h-14 w-full max-w-[520px] items-center gap-1 px-4">
        <div className="theatre-names flex min-w-0 flex-1 flex-col">
          {/* Both rows start with an icon: the same shape means the same thing,
              so neither row reads as a caption. */}
          {/* The name is the visible label, so it is the accessible name too:
              the action rides along as a suffix. An aria-label of "list" over a
              row that reads "الفاتحة" fails WCAG 2.5.3 (label in name). */}
          <button
            type="button"
            onClick={onOpenSurahs}
            className="press flex min-h-9 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[1rem] font-semibold text-ink transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="book" className="text-muted" />
            <span className="min-w-0 flex-1 truncate">{surahName}</span>
            <span className="sr-only">{`— ${t.footer.list}`}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReciters}
            className="press flex min-h-9 min-w-0 items-center gap-2 rounded-full px-2 text-start text-[0.875rem] text-muted transition-colors hover:bg-line active:bg-line"
          >
            <Icon name="mic" />
            <span className="min-w-0 flex-1 truncate">{reciterName}</span>
            <span className="sr-only">{`— ${t.footer.reciter}`}</span>
          </button>
        </div>

        <div ref={rootRef} className="relative shrink-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleClick}
            onPointerDown={startHold}
            onPointerUp={endHold}
            onPointerLeave={endHold}
            onPointerCancel={endHold}
            onContextMenu={(event) => event.preventDefault()}
            aria-label={t.footer.volume}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              'volume-button press flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
              muted ? 'text-ink' : 'text-muted',
            )}
          >
            <Icon name={muted ? 'volume-x' : 'volume'} size={20} />
          </button>

          {open && (
            <div className="volume-popover" role="dialog" aria-label={t.footer.volume}>
              <span className="volume-value tnum" aria-hidden="true">
                {level}%
              </span>
              <div className="volume-rail">
                <span className="volume-track" aria-hidden="true">
                  <span className="volume-fill" style={{ height: `${level}%` }} />
                </span>
                <input
                  ref={inputRef}
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={(event) => onVolume(Number(event.target.value))}
                  aria-label={t.footer.volume}
                  aria-valuetext={muted ? t.footer.muted : `${level}%`}
                  className="volume-range"
                />
              </div>
            </div>
          )}
        </div>

        <button
          id="footer-fullscreen"
          type="button"
          onClick={onToggleFullscreen}
          aria-label={t.footer.fullscreen}
          className="press flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-line active:bg-line"
        >
          <Icon name="fullscreen" size={20} />
        </button>

        {Math.abs(rate - 1) > 0.001 && (
          <button
            type="button"
            onClick={onOpenRate}
            aria-label={t.footer.speedChange(`${Number(rate.toFixed(2))}x`)}
            className="press tnum min-h-11 shrink-0 rounded-full bg-line px-3 text-[0.75rem] font-semibold text-ink transition-colors hover:bg-line/70"
          >
            {Number(rate.toFixed(2))}x
          </button>
        )}

        <button
          type="button"
          onClick={onOpenStream}
          aria-label={
            hasProgress ? `${sourceLabel[source]}, ${percent}%` : sourceLabel[source]
          }
          aria-haspopup="dialog"
          className={cn(
            'press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
            source === 'connected' ? 'text-ink' : 'text-muted',
          )}
        >
          <svg
            viewBox="0 0 44 44"
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-11 w-11 -rotate-90 text-ink"
          >
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.22"
              strokeWidth="2"
            />
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={ring}
              strokeDashoffset={ring * (1 - progress)}
            />
          </svg>
          <StreamSourceIcon source={source} size={20} />
        </button>
      </div>
    </footer>
  );
}
