import { useAtom, useSetAtom } from 'jotai';

import Icon, { type IconName } from '@/components/icons';
import { useLocale } from '@/hooks/use-locale';
import { playbackModeAtom, setPlaybackModeAtom } from '@/jotai/player';
import { cn } from '@/utils/cn';
import { nextPlaybackMode, type PlaybackMode } from '@/utils/playback';

/**
 * How the next surah is chosen, as one control beside the transport.
 *
 * One tap cycles linear → shuffle → repeat-one, and the glyph is the state, so
 * the row keeps a single 44px slot and no panel is needed. It sits here rather
 * than in the footer because the footer is gone in theatre while the transport
 * is not, and because the mode changes what Next means — the answer belongs next
 * to the question.
 */
const ICONS: Record<PlaybackMode, IconName> = {
  linear: 'order',
  shuffle: 'shuffle',
  'repeat-one': 'repeat-one',
};

const LABELS: Record<PlaybackMode, 'linear' | 'shuffle' | 'repeatOne'> = {
  linear: 'linear',
  shuffle: 'shuffle',
  'repeat-one': 'repeatOne',
};

export default function PlaybackModeControl() {
  const { t } = useLocale();
  const [mode] = useAtom(playbackModeAtom);
  const setMode = useSetAtom(setPlaybackModeAtom);

  const labels = {
    linear: t.playback.linear,
    shuffle: t.playback.shuffle,
    repeatOne: t.playback.repeatOne,
  };
  const current = labels[LABELS[mode]];

  return (
    <>
      <button
        type="button"
        onClick={() => setMode(nextPlaybackMode(mode))}
        aria-label={`${t.playback.mode}: ${current}`}
        className={cn(
          'press flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-line hover:text-ink active:bg-line focus-visible:text-ink',
          mode === 'linear' ? 'text-muted' : 'text-ink',
        )}
      >
        <Icon name={ICONS[mode]} size={20} />
      </button>
      {/* The label changes without focus moving, so the new state is announced. */}
      <span role="status" aria-live="polite" className="sr-only">
        {`${t.playback.mode}: ${current}`}
      </span>
    </>
  );
}
