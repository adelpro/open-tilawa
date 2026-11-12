import { useAtom, useSetAtom } from 'jotai';
import { useEffect, useRef, useState } from 'react';

import Icon, { type IconName } from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';
import { playbackModeAtom, setPlaybackModeAtom } from '@/jotai/player';
import { cn } from '@/utils/cn';
import type { PlaybackMode } from '@/utils/playback';

/**
 * How the next surah is chosen, as one control beside the transport.
 *
 * The icon is the active mode, so the row keeps a single 44px slot; the menu is
 * the label. It sits here rather than in the footer because the footer is gone in
 * theatre while the transport is not, and because the mode changes what Next
 * means — the answer belongs next to the question.
 */
type Labels = {
  linear: string;
  shuffle: string;
  repeatOne: string;
};

const OPTIONS: readonly { mode: PlaybackMode; icon: IconName; label: keyof Labels }[] = [
  { mode: 'linear', icon: 'order', label: 'linear' },
  { mode: 'shuffle', icon: 'shuffle', label: 'shuffle' },
  { mode: 'repeat-one', icon: 'repeat-one', label: 'repeatOne' },
];

export default function PlaybackModeControl() {
  const { t } = useLocale();
  const [mode] = useAtom(playbackModeAtom);
  const setMode = useSetAtom(setPlaybackModeAtom);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const labels: Labels = {
    linear: t.playback.linear,
    shuffle: t.playback.shuffle,
    repeatOne: t.playback.repeatOne,
  };
  const current = labels[OPTIONS.find((option) => option.mode === mode)?.label ?? 'linear'];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  const choose = (next: PlaybackMode) => {
    // The write atom clears the queue, so selecting the active shuffle again is
    // a request for a new order.
    setMode(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="playback-mode-options"
        aria-label={`${t.playback.mode}: ${current}`}
        className={cn(
          'press flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-line hover:text-ink active:bg-line focus-visible:text-ink',
          mode === 'linear' ? 'text-muted' : 'text-ink',
        )}
      >
        <Icon name={OPTIONS.find((option) => option.mode === mode)?.icon ?? 'order'} size={20} />
      </button>

      {open && (
        <div
          id="playback-mode-options"
          role="group"
          aria-label={t.playback.mode}
          className="absolute bottom-full end-0 z-20 mb-2 w-52 rounded-xl border border-line bg-canvas p-1 shadow-lg"
        >
          {OPTIONS.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => choose(option.mode)}
                aria-pressed={active}
                className={cn(
                  'press flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-start text-[0.875rem] text-ink transition-colors hover:bg-line',
                  active && 'font-semibold',
                )}
              >
                <Icon name={option.icon} />
                <span className="min-w-0 flex-1 truncate">{labels[option.label]}</span>
                {active ? <Icon name="check" /> : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
