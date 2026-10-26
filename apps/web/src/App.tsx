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
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { isPlayingAtom, rateAtom, visualiserAtom } from './jotai/player';
import { normaliseVisualiser } from './utils/visualiser-models';
import { selectedReciterAtom } from './jotai/atom';
import { patchState } from './hooks/use-persistence';

/**
 * A top bar, one routed view, and the `<audio>` element that outlives all of
 * them — the reason playback keeps going when you leave the player for a page.
 */
export default function App() {
  const { route, navigate } = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const setIsPlaying = useSetAtom(isPlayingAtom);
  const [rate, setRate] = useAtom(rateAtom);
  const [visualiser, setVisualiser] = useAtom(visualiserAtom);

  const chooseVisualiser = (next: ReturnType<typeof normaliseVisualiser>) => {
    setVisualiser(next);
    patchState({ visualiser: next });
  };
  const reciter = useAtomValue(selectedReciterAtom);

  const chooseRate = (next: number) => {
    setRate(next);
    patchState({ rate: next });
  };
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
          <PlayerPage onOpenMenu={() => setMenuOpen(true)} />
        )}

        <NavSheet
          open={menuOpen}
          route={route}
          sleepActive={sleep.active}
          sleepRemaining={sleep.remaining}
          onSleep={sleep.start}
          rate={rate}
          onRate={chooseRate}
          visualiser={visualiser}
          onVisualiser={chooseVisualiser}
          onClose={() => setMenuOpen(false)}
          onNavigate={go}
        />
      </div>
      {/* A new element per reciter class: once an element is routed through Web
          Audio it cannot be released, and a cross-origin host would play silent. */}
      {/* `p2p` while the reciter is still unknown, so boot does not remount the
          engine and abort the session open. */}
      <AudioEngine key={reciter && !reciter.magnet ? 'http' : 'p2p'} />
    </ErrorBoundary>
  );
}
