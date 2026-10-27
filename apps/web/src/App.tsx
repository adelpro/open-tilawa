import { useEffect, useRef, useState } from 'react';

import AboutPage from './app/about-page';
import PlayerPage from './app/player-page';
import PrivacyPage from './app/privacy-page';
import SettingsPage from './app/settings-page';
import AudioEngine from './components/audio-engine';
import ErrorBoundary from './components/error-boundary';
import NavSheet from './components/nav-sheet';
import TopBar from './components/top-bar';
import { useHashRoute } from './hooks/use-hash-route';
import { useMediaQuery } from './hooks/use-media-query';
import { useSheet } from './hooks/use-sheet';
import { useSleepTimer } from './hooks/use-sleep-timer';
import { useLocale } from './hooks/use-locale';
import { useTheme } from './hooks/use-theme';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { isPlayingAtom, rateAtom, visualiserAtom } from './jotai/player';
import { normaliseVisualiser } from './utils/visualiser-models';
import { selectedReciterAtom } from './jotai/atom';
import { patchSettings } from './hooks/use-persistence';

/**
 * A top bar, one routed view, and the `<audio>` element that outlives all of
 * them — the reason playback keeps going when you leave the player for a page.
 */
export default function App() {
  const { route, navigate } = useHashRoute();
  const [menuOpen, setMenuOpen] = useState(false);
  const { sheet, pinned, togglePin, openSurahs, openReciters, openStream, openKeys, close } =
    useSheet();
  const setIsPlaying = useSetAtom(isPlayingAtom);
  const wide = useMediaQuery('(min-width: 1024px)');
  const pinnedBooted = useRef(false);
  useEffect(() => {
    if (pinnedBooted.current || !wide) return;
    pinnedBooted.current = true;
    if (pinned) openReciters();
  }, [wide, pinned, openReciters]);

  const { locale, setLocale } = useLocale();
  const { theme, setTheme } = useTheme();
  const [rate, setRate] = useAtom(rateAtom);
  const [visualiser, setVisualiser] = useAtom(visualiserAtom);

  const chooseVisualiser = (next: ReturnType<typeof normaliseVisualiser>) => {
    setVisualiser(next);
    patchSettings({ visualiser: next });
  };
  const reciter = useAtomValue(selectedReciterAtom);

  const chooseRate = (next: number) => {
    setRate(next);
    patchSettings({ rate: next });
  };
  const sleep = useSleepTimer(() => setIsPlaying(false));

  const go = (next: Parameters<typeof navigate>[0]) => {
    navigate(next);
    setMenuOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="app-shell" data-panel={sheet ? 'open' : 'closed'}>
        <TopBar
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          onOpenSurahs={openSurahs}
          onOpenReciters={openReciters}
          onOpenKeys={openKeys}
        />

        {route === '/about' ? (
          <AboutPage />
        ) : route === '/privacy' ? (
          <PrivacyPage />
        ) : route === '/settings' ? (
          <SettingsPage
            theme={theme}
            onTheme={setTheme}
            locale={locale}
            onLocale={setLocale}
            rate={rate}
            onRate={chooseRate}
            visualiser={visualiser}
            onVisualiser={chooseVisualiser}
            sleepActive={sleep.active}
            sleepRemaining={sleep.remaining}
            onSleep={sleep.start}
          />
        ) : (
          <PlayerPage
            sheet={sheet}
            pinned={pinned}
            togglePin={togglePin}
            openSurahs={openSurahs}
            openReciters={openReciters}
            openStream={openStream}
            openKeys={openKeys}
            close={close}
            onOpenMenu={() => setMenuOpen(true)}
          />
        )}

        <NavSheet
          open={menuOpen}
          route={route}
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
