import { useEffect, useRef, useState } from 'react';

import AboutPage from './app/about-page';
import RecitersPage from './app/reciters-page';
import SurahPage from './app/surah-page';
import PlayerPage from './app/player-page';
import NotFoundPage from './app/not-found-page';
import TelemetryPrompt from './components/telemetry-prompt';
import PrivacyPage from './app/privacy-page';
import SettingsPage from './app/settings-page';
import AudioEngine from './components/audio-engine';
import ErrorBoundary from './components/error-boundary';
import NavSheet from './components/nav-sheet';
import TopBar from './components/top-bar';
import AccountSheet from './components/account/account-sheet';
import { useRoute } from './hooks/use-route';
import { useReciters } from './hooks/use-reciters';
import { resolveDeepLink } from './utils/deep-link';
import { useMediaQuery } from './hooks/use-media-query';
import { useSheet } from './hooks/use-sheet';
import { useSleepTimer } from './hooks/use-sleep-timer';
import { useLocale } from './hooks/use-locale';
import { useTheme } from './hooks/use-theme';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';

import { isPlayingAtom, rateAtom, visualiserAtom } from './jotai/player';
import { normaliseVisualiser } from './utils/visualiser-models';
import { selectedReciterAtom, accountSheetOpenAtom } from './jotai/atom';
import { currentSurahIdAtom } from './jotai/player';
import { toPath } from './routes';
import { createTelemetry, deviceEvent, firstPlayEvent, type TelemetryEvent } from './utils/telemetry';
import {
  markDeviceDay,
  markListenDay,
  readDeviceDay,
  readListenDay,
  shouldReportDevice,
  utcDay,
} from './utils/device-day';
import { STORAGE_EVENT } from './utils/storage-keys';
import { APP_VERSION } from './constants/version';
import {
  consentEnabled,
  readConsent,
  shouldPrompt,
  writeConsent,
  type Consent,
} from './utils/telemetry-consent';
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
  const { route, navigate, params } = useRoute();
  const { reciters } = useReciters();
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    sheet,
    pinned,
    togglePin,
    reciterScope,
    openSurahs,
    openReciters,
    openRecitersAt,
    openStream,
    openKeys,
    close,
  } = useSheet();
  const setIsPlaying = useSetAtom(isPlayingAtom);

  /**
   * A `/listen/<release>/<surah>` link opens that recitation, paused.
   *
   * Autoplay is blocked by the browser anyway, and a shared link that starts shouting
   * on load is a bad first impression. A stale name segment is a redirect to the
   * canonical one; a slug nobody knows is the not-found screen, not the player.
   */
  const [deepLinkMissing, setDeepLinkMissing] = useState(false);
  const setSelectedReciter = useSetAtom(selectedReciterAtom);
  const setSurahId = useSetAtom(currentSurahIdAtom);
  const appliedLink = useRef('');

  useEffect(() => {
    if (route.name !== 'listen' || reciters.length === 0) return;
    const href = toPath(route);
    if (appliedLink.current === href) return;

    const resolution = resolveDeepLink(route, reciters);
    if (resolution.kind === 'missing') {
      setDeepLinkMissing(true);
      return;
    }
    setDeepLinkMissing(false);
    appliedLink.current = href;

    if (resolution.kind === 'moved') {
      navigate({ name: 'listen', release: resolution.to.split('/')[2], surah: route.surah, surahName: '' }, 'replace');
      return;
    }
    setSelectedReciter(resolution.reciter);
    setSurahId(resolution.surah);
    setIsPlaying(false);
  }, [route, reciters, navigate, setSelectedReciter, setSurahId, setIsPlaying]);
  const wide = useMediaQuery('(min-width: 1024px)');
  const pinnedBooted = useRef(false);
  useEffect(() => {
    if (pinnedBooted.current || !wide) return;
    pinnedBooted.current = true;
    if (pinned) openReciters();
  }, [wide, pinned, openReciters]);

  /**
   * The installed shortcut: `?view=favorites` opens the roster on the
   * listener's own list. Declared after the pinned boot so it wins on a wide
   * screen; the param stays in the URL, so closing the panel and reopening it
   * by hand is an ordinary visit.
   */
  useEffect(() => {
    if (params.get('view') === 'favorites') openRecitersAt('mine');
  }, [params, openRecitersAt]);

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
  /**
   * The consent gate. `heardSound` flips once, the first time playback actually starts —
   * asking before that is asking about something the listener has not experienced yet.
   */
  const [consent, setConsent] = useState<Consent>(() => readConsent());
  const [heardSound, setHeardSound] = useState(false);
  const playing = useAtomValue(isPlayingAtom);
  useEffect(() => {
    if (playing) setHeardSound(true);
  }, [playing]);

  const telemetry = useRef(
    createTelemetry({
      enabled: () => consentEnabled(readConsent()),
      send: async (batch) => {
        const base =
          (import.meta as { env?: Record<string, string> }).env?.VITE_ADMIN_API_URL ||
          'https://console.tilawah.cc';
        await fetch(`${base}/api/public/telemetry`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
          keepalive: true,
        });
      },
    }),
  );

  /**
   * One "a device was here today" row per consenting device per day.
   *
   * Deliberately not tied to playback: the question the row answers is how many devices
   * open the app, and a device that only reads the catalogue still counts. The flag is
   * local and the event is empty of identity, so the server counts rows it cannot join.
   */
  useEffect(() => {
    if (!consentEnabled(consent)) return;
    const day = utcDay();
    if (!shouldReportDevice(readDeviceDay(), day)) return;
    markDeviceDay(day);
    telemetry.current.record(deviceEvent({ version: APP_VERSION, locale }));
  }, [consent, locale]);

  const answerConsent = (value: Consent) => {
    writeConsent(value);
    setConsent(value);
    if (!consentEnabled(value)) telemetry.current.stop();
  };

  /**
   * A tab can go away between two 30-second ticks. Flush what is queued before it
   * does; the sender's `keepalive` is what lets the request finish.
   */
  useEffect(() => {
    const flush = () => {
      void telemetry.current.flush();
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
    };
  }, []);

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
    window.addEventListener(STORAGE_EVENT, handler);
    return () => window.removeEventListener(STORAGE_EVENT, handler);
  }, [updateSettings]);

  const go = (next: Parameters<typeof navigate>[0]) => {
    navigate(next);
    setMenuOpen(false);
  };

  return (
    <ErrorBoundary>
      <div className="app-shell" data-panel={sheet ? 'open' : 'closed'}>
        <TopBar
          isHome={route.name === 'home'}
          menuOpen={menuOpen}
          onToggleMenu={() => setMenuOpen((open) => !open)}
          onOpenSurahs={openSurahs}
          onOpenReciters={openReciters}
          onOpenKeys={openKeys}
          onOpenAccount={() => setAccountOpen(true)}
        />

        {route.name === 'reciters' ? (
          <RecitersPage />
        ) : route.name === 'surah' ? (
          <SurahPage id={route.surah} />
        ) : route.name === 'about' ? (
          <AboutPage />
        ) : route.name === 'privacy' ? (
          <PrivacyPage />
        ) : route.name === 'notFound' || deepLinkMissing ? (
          <NotFoundPage onHome={() => go({ name: 'home' })} />
        ) : route.name === 'settings' ? (
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
            reciterScope={reciterScope}
            openSurahs={openSurahs}
            openReciters={openReciters}
            openStream={openStream}
            openKeys={openKeys}
            close={close}
            onOpenMenu={() => setMenuOpen(true)}
            route={route}
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
        {shouldPrompt(consent, heardSound) && (
          <TelemetryPrompt
            onAccept={() => answerConsent('on')}
            onDecline={() => answerConsent('off')}
          />
        )}
      </div>
      {/* A new element per reciter class: once an element is routed through Web
          Audio it cannot be released, and a cross-origin host would play silent. */}
      {/* `p2p` while the reciter is still unknown, so boot does not remount the
          engine and abort the session open. */}
      <AudioEngine
        route={route}
        record={(event: TelemetryEvent) => {
          // The day's first play is announced before the play it announces: the
          // listener count must never be behind the plays that prove it happened.
          if (event.event === 'play' && consentEnabled(readConsent())) {
            const day = utcDay();
            if (shouldReportDevice(readListenDay(), day)) {
              markListenDay(day);
              telemetry.current.record(firstPlayEvent({ version: APP_VERSION, locale }));
            }
          }
          telemetry.current.record(event);
        }}
        key={reciter && !reciter.magnet ? 'http' : 'p2p'}
      />
    </ErrorBoundary>
  );
}
