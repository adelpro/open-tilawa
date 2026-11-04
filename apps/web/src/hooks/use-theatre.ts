import { useCallback, useEffect, useState } from 'react';

/**
 * Fullscreen, with the browser as the source of truth and an in-app fallback.
 *
 * The icon must not lie: every route out of fullscreen — our button, Esc, the
 * browser's own chrome — arrives as `fullscreenchange`, so the same listener
 * updates the shell. Where an element cannot go fullscreen (iPhone Safari), the
 * same theatre layout runs as an overlay, and Esc or the exit control leaves it.
 */
export function useTheatre(): {
  active: boolean;
  toggle: () => void;
  exit: () => void;
} {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(Boolean(document.fullscreenElement));
    sync();
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggle = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // The browser already left; the listener will say so.
      });
      return;
    }

    const request = document.documentElement.requestFullscreen;
    if (typeof request !== 'function') {
      setActive(true);
      return;
    }

    request.call(document.documentElement).catch(() => {
      // Not supported, refused, or blocked: keep the same layout in-app.
      setActive(true);
    });
  }, []);

  const exit = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {
        // Nothing to do; the overlay state below still closes the shell.
      });
    }
    setActive(false);
  }, []);

  useEffect(() => {
    if (!active || document.fullscreenElement) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active]);

  return { active, toggle, exit };
}
