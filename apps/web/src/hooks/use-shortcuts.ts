import { useEffect, useRef } from 'react';

export type ShortcutHandlers = {
  onPlayPause: () => void;
  onBack: () => void;
  onForward: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onReciters: () => void;
  onSurahs: () => void;
  onMute: () => void;
  onHelp: () => void;
  onClose: () => void;
  /** Called on any shortcut, so a first-visit hint can retire itself. */
  onAny: () => void;
};

function isTyping(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || node.isContentEditable;
}

/**
 * Desktop keyboard control. Registered only when the layout is wide and the
 * pointer is a mouse, so a phone with a Bluetooth keyboard is not surprised by
 * a space bar that seeks.
 */
export function useShortcuts(enabled: boolean, handlers: ShortcutHandlers): void {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const run = latest.current;
      switch (event.key) {
        case ' ':
          event.preventDefault();
          run.onPlayPause();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          run.onBack();
          break;
        case 'ArrowRight':
          event.preventDefault();
          run.onForward();
          break;
        case 'ArrowUp':
          event.preventDefault();
          run.onPrevious();
          break;
        case 'ArrowDown':
          event.preventDefault();
          run.onNext();
          break;
        case 'r':
        case 'R':
          run.onReciters();
          break;
        case 's':
        case 'S':
          run.onSurahs();
          break;
        case 'm':
        case 'M':
          run.onMute();
          break;
        case '?':
          run.onHelp();
          break;
        case 'Escape':
          run.onClose();
          break;
        default:
          return;
      }
      run.onAny();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
