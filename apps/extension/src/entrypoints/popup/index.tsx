/**
 * The popup: a status card, not a second options page.
 *
 * It answers "is it working, how much has it given, and where do I change it" in
 * that order. Everything comes from the background, which owns the gate and the
 * counters — a popup that asked the engine directly would be a second source of
 * truth for "is it running".
 *
 * An empty first run is the one exception. Nobody installs an add-on to see a
 * grey dot and a sentence, so the empty state asks the two questions that decide
 * what this device will hold (mode and budget) and hands over one door. The
 * answers live in `settings.v1` like every other switch, so the options page
 * shows them already answered.
 */

import { StrictMode, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { browser } from 'wxt/browser';

import '@/styles.css';
import './popup.css';

import { formatBytes } from '@/lib/badge';
import { reciterUrl, type HeldReciter } from '@/lib/catalogue';
import { copyFor, pickLang } from '@/lib/i18n';
import type { Counters } from '@/lib/messages';
import { loadHeld, loadSettings, parseSettings, saveSettings, type Settings } from '@/lib/settings';
import type { HeldState } from '@/lib/state';
import { ask } from '@/lib/ui-bridge';
import { HeldRow } from '@/components/roster-row';

const MODES: Settings['mode'][] = ['manual', 'follow', 'mixed'];
const DISK_CHOICES = [0, 3, 6, 10, 20, 30, 50, 100];

function Popup() {
  const copy = useMemo(() => copyFor(pickLang(browser.i18n.getUILanguage())), []);
  const lang = copy.dir === 'rtl' ? 'ar' : 'en';
  const manifest = browser.runtime.getManifest();

  const [held, setHeld] = useState<HeldReciter[]>([]);
  const [states, setStates] = useState<HeldState[]>([]);
  const [counters, setCounters] = useState<Counters>({ today: 0, total: 0 });
  const [pending, setPending] = useState(0);
  const [paused, setPaused] = useState(false);
  const [mode, setMode] = useState<Settings['mode']>('mixed');
  const [maxDiskGb, setMaxDiskGb] = useState(6);

  useEffect(() => {
    let live = true;

    const read = async () => {
      const [roster, settings, reply] = await Promise.all([
        loadHeld<HeldReciter>(),
        loadSettings(),
        ask({ type: 'state:snapshot' }),
      ]);
      if (!live) return;
      setHeld(roster);
      setStates(reply.states ?? []);
      setCounters(reply.counters ?? { today: 0, total: 0 });
      setPending(reply.pending ?? 0);
      setPaused(settings.paused);
      setMode(settings.mode);
      setMaxDiskGb(settings.maxDiskGb);
    };

    void read();
    const timer = setInterval(() => void read(), 5000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
      if (area !== 'local' || !changes['tilawah-companion.settings.v1']) return;
      const next = parseSettings(changes['tilawah-companion.settings.v1'].newValue);
      setPaused(next.paused);
      setMode(next.mode);
      setMaxDiskGb(next.maxDiskGb);
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  const togglePause = async () => {
    const next = !paused;
    setPaused(next);
    await ask({ type: next ? 'state:pause' : 'state:resume' });
  };

  /**
   * The two first-run answers. Both write the same settings record the options
   * page edits, so there is one truth and no "which screen wins" question.
   */
  const chooseMode = async (next: Settings['mode']) => {
    setMode(next);
    await saveSettings({ mode: next });
  };

  const chooseQuota = async (next: number) => {
    setMaxDiskGb(next);
    await saveSettings({ maxDiskGb: next });
  };

  const byHash = new Map(states.map((state) => [state.infohash, state]));
  const seeding = states.filter((state) => state.state === 'seeding').length;
  const peers = states.reduce((sum, state) => sum + state.peers, 0);

  const headline = paused
    ? copy.pausedHeadline
    : seeding > 0
      ? copy.seedingHeadline.replace('{n}', String(seeding)).replace('{p}', String(peers))
      : states.length > 0
        ? copy.workingHeadline
        : copy.idleHeadline;

  const open = (hash: string) => {
    void browser.tabs.create({ url: browser.runtime.getURL(`/options.html${hash}`) });
    window.close();
  };

  const modeLabel = (value: Settings['mode']) =>
    value === 'manual' ? copy.modeManual : value === 'follow' ? copy.modeFollow : copy.modeMixed;

  const modeHint = (value: Settings['mode']) =>
    value === 'manual' ? copy.modeManualHint : value === 'follow' ? copy.modeFollowHint : copy.modeMixedHint;

  return (
    <main className="popup" dir={copy.dir}>
      <header className="popup-head">
        <img src="/icon/32.png" alt="" width={22} height={22} />
        <span className="name">
          {copy.title}{' '}
          <bdi className="meta" dir="ltr">
            {manifest.version_name ?? manifest.version}
          </bdi>
        </span>
        <button type="button" className="action" onClick={() => void togglePause()}>
          {paused ? copy.resumeShort : copy.pauseShort}
        </button>
      </header>

      <p className="headline" data-paused={paused}>
        {headline}
      </p>

      {held.length === 0 ? (
        <section className="setup" aria-labelledby="setup-title">
          <h2 id="setup-title">{copy.setupTitle}</h2>
          <p className="empty">{copy.lede}</p>

          <div className="setup-row">
            <span className="setup-label" id="setup-mode-label">
              {copy.modeLabel}
            </span>
            <div className="seg" role="radiogroup" aria-labelledby="setup-mode-label">
              {MODES.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={mode === value}
                  onClick={() => void chooseMode(value)}
                >
                  {modeLabel(value)}
                </button>
              ))}
            </div>
            <p className="setup-hint">{modeHint(mode)}</p>
          </div>

          <div className="setup-row">
            <label className="setup-label" htmlFor="setup-disk">
              {copy.maxDiskLabel}
            </label>
            <select
              id="setup-disk"
              value={maxDiskGb}
              onChange={(event) => void chooseQuota(Number(event.target.value))}
            >
              {DISK_CHOICES.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? copy.diskUnlimited : `${value} GB`}
                </option>
              ))}
            </select>
          </div>

          <button type="button" className="primary setup-cta" onClick={() => open('#/reciters')}>
            {copy.welcomeCta}
          </button>
        </section>
      ) : (
        <ul className="held">
          {held.map((reciter) => {
            const state = byHash.get(reciter.infohash) ?? {
              infohash: reciter.infohash,
              state: 'queued' as const,
              peers: 0,
              progress: 0,
              uploadedToday: 0,
            };
            return (
              <HeldRow
                key={reciter.infohash}
                name={reciter.nameAr || reciter.name}
                href={reciterUrl(reciter.slug)}
                size={formatBytes(reciter.sizeBytes ?? 0)}
                state={state}
                lang={lang}
              />
            );
          })}
        </ul>
      )}

      <dl className="counters">
        <div>
          <dt>{copy.uploadedToday}</dt>
          <dd>
            <bdi>{formatBytes(counters.today)}</bdi>
          </dd>
        </div>
        <div>
          <dt>{copy.uploadedTotal}</dt>
          <dd>
            <bdi>{formatBytes(counters.total)}</bdi>
          </dd>
        </div>
      </dl>

      <nav className="popup-links">
        <button type="button" className="link" onClick={() => open('#/reciters')}>
          {copy.navReciters}
          {pending > 0 ? <span className="pill">{pending}</span> : null}
        </button>
        <button type="button" className="link" onClick={() => open('#/settings')}>
          {copy.navSettings}
        </button>
        <button type="button" className="link" onClick={() => open('#/about')}>
          {copy.navAbout}
        </button>
      </nav>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
