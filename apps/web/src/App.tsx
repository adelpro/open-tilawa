import { useEffect, useRef, useState } from 'react';

import AboutPage from './app/about-page';
import PlayerPage from './app/player-page';
import PrivacyPage from './app/privacy-page';
import SettingsPage from './app/settings-page';
import AudioEngine from './components/audio-engine';
import ErrorBoundary from './components/error-boundary';
import NavSheet from './components/nav-sheet';
import TopBar from './components/top-bar';
import AccountSheet from './components/account/account-sheet';
import { useHashRoute } from './hooks/use-hash-route';
import { useMediaQuery } from './hooks/use-media-query';
import { useSheet } from './hooks/use-sheet';
import { useSleepTimer } from './hooks/use-sleep-timer';
import { useLocale } from './hooks/use-locale';
import { useTheme } from './hooks/use-theme';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { isPlayingAtom, rateAtom, visualiserAtom } from './jotai/player';
import { normaliseVisualiser } from './utils/visualiser-models';
import { selectedReciterAtom, accountSheetOpenAtom } from './jotai/atom';
import { userSettingsAtom } from './jotai/gun';
import { patchSettings, hydrateSettings, loadState, resolveRemoteSettings, shouldPushLocalSettings } from './hooks/use-persistence';
import { useUserSync } from './hooks/use-user-sync';
import { useGlobalCounts } from './hooks/use-global-counts';
import { useTrackView } from './hooks/use-favorites';
import { useHydrateRecent, useRecentSync, useRecordRecent } from './hooks/use-recent';

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

  const { locale, setLocale, adoptLocale } = useLocale();
  const { theme, setTheme, adoptTheme } = useTheme();
  const [rate, setRate] = useAtom(rateAtom);
  const [visualiser, setVisualiser] = useAtom(visualiserAtom);
  const [accountOpen, setAccountOpen] = useAtom(accountSheetOpenAtom);
  const remoteSettings = useAtomValue(userSettingsAtom);

  // One mount, one set of relay subscriptions and one device heartbeat. This
  // hook is not idempotent per caller: each call registers its own `.on()`
  // listeners, so a second call to read `updateSettings` doubled everything.
  const { updateSettings } = useUserSync();
  useGlobalCounts();
  useTrackView();
  useHydrateRecent();
  useRecordRecent();
  useRecentSync();

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

  /**
   * Account settings land here, once per newer stamp. `hydrateSettings` writes
   * them to localStorage without dispatching the write-back event, and the
   * `adopt*` setters update the atoms without re-stamping — so receiving a
   * value can never bounce it back to the relay.
   */
  useEffect(() => {
    const local = loadState().settings;
    const applied = resolveRemoteSettings(local, remoteSettings);

    if (applied) {
      hydrateSettings(applied);
      if (applied.rate !== undefined) setRate(applied.rate);
      if (applied.visualiser) setVisualiser(applied.visualiser);
      if (applied.locale) adoptLocale(applied.locale);
      if (applied.theme) adoptTheme(applied.theme);
      return;
    }

    // The account is older (or silent) and this device has a newer choice —
    // send it up once, so a second device can adopt it.
    if (shouldPushLocalSettings(local, remoteSettings)) updateSettings(local);
  }, [remoteSettings, setRate, setVisualiser, adoptLocale, adoptTheme, updateSettings]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as Record<string, unknown>;
      if (detail && typeof detail === 'object') {
        updateSettings(detail as any);
      }
    };
    window.addEventListener('open-tilawa:settings', handler);
    return () => window.removeEventListener('open-tilawa:settings', handler);
  }, [updateSettings]);

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
          onOpenAccount={() => setAccountOpen(true)}
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
          onOpenAccount={() => setAccountOpen(true)}
        />
        <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} />
      </div>
      {/* A new element per reciter class: once an element is routed through Web
          Audio it cannot be released, and a cross-origin host would play silent. */}
      {/* `p2p` while the reciter is still unknown, so boot does not remount the
          engine and abort the session open. */}
      <AudioEngine key={reciter && !reciter.magnet ? 'http' : 'p2p'} />
    </ErrorBoundary>
  );
}
