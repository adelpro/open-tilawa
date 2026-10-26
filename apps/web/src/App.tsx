import { useState } from 'react';

import AboutPage from './app/about-page';
import PlayerPage from './app/player-page';
import PrivacyPage from './app/privacy-page';
import AudioEngine from './components/audio-engine';
import ErrorBoundary from './components/error-boundary';
import NavSheet from './components/nav-sheet';
import TopBar from './components/top-bar';
import { useHashRoute } from './hooks/use-hash-route';
import { useSleepTimer } from './hooks/use-sleep-timer';
import { useSetAtom } from 'jotai';

import { isPlayingAtom } from './jotai/player';

/**
 * A top bar, one routed view, and the `<audio>` element that outlives all of
 * them — the reason playback keeps going when you leave the player for a page.
 */
export default function App() {
  const { route, navigate } = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const setIsPlaying = useSetAtom(isPlayingAtom);
  const sleep = useSleepTimer(() => setIsPlaying(false));

  const go = (next: Parameters<typeof navigate>[0]) => {
    navigate(next);
    setMenuOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="app-shell">
        <TopBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />

        {route === '/about' ? (
          <AboutPage />
        ) : route === '/privacy' ? (
          <PrivacyPage />
        ) : (
          <PlayerPage />
        )}

        <NavSheet
          open={menuOpen}
          route={route}
          sleepActive={sleep.active}
          sleepRemaining={sleep.remaining}
          onSleep={sleep.start}
          onClose={() => setMenuOpen(false)}
          onNavigate={go}
        />
      </div>
      <AudioEngine />
    </ErrorBoundary>
  );
}
