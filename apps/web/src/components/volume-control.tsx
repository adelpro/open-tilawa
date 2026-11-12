import { useEffect, useRef, useState } from 'react';

import Icon from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';
import { cn } from '@/utils/cn';

/** A hold shorter than this is a tap that opened the gauge. */
const LONG_PRESS_MS = 500;

/**
 * The speaker, two controls in one: a tap opens the level gauge (0 is mute), a
 * hold mutes immediately. The gauge is a popover rather than a second row, so
 * the control keeps a thumb-sized footprint.
 *
 * It lives with the transport's functions row rather than in the mini-player:
 * the volume is a listener control, and the footer disappears in theatre.
 */
export default function VolumeControl({
  volume,
  onVolume,
  onToggleMute,
}: {
  /** 0–1. Zero is the mute state everywhere in this component. */
  volume: number;
  onVolume: (volume: number) => void;
  onToggleMute: () => void;
}) {
  const { t } = useLocale();
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
  const startHold = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
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

  /** A pointer that left or was cancelled cannot produce a click on us. */
  const cancelHold = () => {
    clearHold();
    firedRef.current = false;
  };

  const handleClick = () => {
    if (firedRef.current) {
      firedRef.current = false;
      return;
    }
    setOpen((value) => !value);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        onPointerDown={startHold}
        onPointerUp={endHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={muted ? t.footer.volumeMuted : t.footer.volume}
        aria-expanded={open}
        className={cn(
          'volume-button press flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-line active:bg-line',
          muted ? 'text-ink' : 'text-muted',
        )}
      >
        <Icon name={muted ? 'volume-x' : 'volume'} size={20} />
      </button>

      {open && (
        <div className="volume-popover" onContextMenu={(event) => event.preventDefault()}>
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
  );
}
