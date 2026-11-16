/**
 * The options page: state here, views in `views/`, one hash in the URL.
 *
 * This file owns the data the four views read — the catalogue, the held list,
 * the selection, the plan — and nothing about how a section looks. The browser
 * is the router (`lib/router.ts`), so a reload keeps the view and the back
 * button leaves it.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { browser } from 'wxt/browser';

import '@/styles.css';

import { formatBytes } from '@/lib/badge';
import type { HeldReciter, Reciter } from '@/lib/catalogue';
import { copyFor, pickLang } from '@/lib/i18n';
import { NEW_SEEN_KEY, markSeen, pickNew } from '@/lib/new-reciter';
import { DEFAULT_VIEW, watchView, viewFromHash, type View } from '@/lib/router';
import { planSelection } from '@/lib/selection';
import {
  SETTINGS_KEY,
  loadHeldReciters,
  loadSettings,
  parseSettings,
  parseUploadMbps,
  saveHeld,
  saveSettings,
  type Settings,
} from '@/lib/settings';
import { filterByRiwaya } from '@/lib/filter';
import { loadPrefs, savePrefs, DEFAULTS as PREFS_DEFAULTS, type Prefs } from '@/lib/prefs';
import { sortReciters, type Sort, DEFAULT_SORT } from '@/lib/sort';
import { fetchCatalogue } from '@/lib/sync';
import { ask } from '@/lib/ui-bridge';
import { Nav } from '@/components/nav';
import { SummaryBar } from '@/components/summary-bar';
import { AboutView } from '@/views/about';
import { WelcomeView } from '@/views/welcome';
import { RecitersView } from '@/views/reciters';
import { SettingsView } from '@/views/settings';

const PENDING_KEY = 'tilawah-companion.pending.v1';
type Disk = { quota: number; usage: number };

function Page() {
  const copy = useMemo(() => copyFor(pickLang(browser.i18n.getUILanguage())), []);
  const lang = copy.dir === 'rtl' ? 'ar' : 'en';
  const manifest = browser.runtime.getManifest();
  const version = manifest.version_name ?? manifest.version;

  const [view, setView] = useState<View>(() => viewFromHash(window.location.hash));
  const [rows, setRows] = useState<Reciter[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [held, setHeld] = useState<HeldReciter[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [uploadDraft, setUploadDraft] = useState('1');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fresh, setFresh] = useState<Reciter[]>([]);
  const [seen, setSeen] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<Prefs>(PREFS_DEFAULTS);
  const [disk, setDisk] = useState<Disk | null>(null);
  const [status, setStatus] = useState<{ text: string; tone: 'idle' | 'error' }>({ text: '', tone: 'idle' });
  const [saving, setSaving] = useState(false);
  /** The pause lives in the background; this page only renders it. */
  const [paused, setPaused] = useState(false);
  /** Settings save themselves; the primary button is for the selection. */
  const hydrated = useRef(false);
  /** A reciter the person tried to add at the cap — the raise offer. */
  const [capPrompt, setCapPrompt] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const canReadBattery = typeof (navigator as { getBattery?: unknown }).getBattery === 'function';
  const canReadConnection = 'connection' in navigator;

  useEffect(() => watchView(setView), []);

  // The popup can pause or resume while this page is open; follow the store, do
  // not keep a second copy of the truth.
  useEffect(() => {
    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'local' || !changes[SETTINGS_KEY]) return;
      const next = parseSettings(changes[SETTINGS_KEY].newValue);
      setPaused(next.paused);
      setSettings((current) => (current ? { ...current, paused: next.paused } : current));
    };
    browser.storage.onChanged.addListener(listener);
    return () => browser.storage.onChanged.removeListener(listener);
  }, []);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setFailed(false);

    void Promise.all([
      fetchCatalogue(),
      loadHeldReciters(),
      loadSettings(),
      loadPrefs(),
      browser.storage.local.get(NEW_SEEN_KEY),
      navigator.storage?.estimate?.().catch(() => undefined) ?? Promise.resolve(undefined),
    ]).then(
      async ([roster, storedHeld, storedSettings, storedPrefs, storedSeen, estimate]) => {
        if (!live) return;

        const seen = Array.isArray(storedSeen[NEW_SEEN_KEY]) ? (storedSeen[NEW_SEEN_KEY] as string[]) : [];
        // First visit learns the roster silently; a returning visit keeps what is
        // new on screen until the person dismisses it or leaves the view.
        if (seen.length === 0) {
          const baseline = roster.map((row) => row.infohash);
          await browser.storage.local.set({ [NEW_SEEN_KEY]: baseline, [PENDING_KEY]: 0 });
          if (!live) return;
          setSeen(baseline);
        } else {
          const freshly = pickNew(roster, seen);
          setSeen(markSeen(seen, freshly.map((row) => row.infohash)));
          // Showing the strip *is* seeing it. The list stays on screen for this
          // visit from state, but the store is updated now — closing the tab
          // without clicking anything must not bring the badge back.
          setFresh(freshly);
          await browser.storage.local.set({
            [NEW_SEEN_KEY]: markSeen(seen, freshly.map((row) => row.infohash)),
            [PENDING_KEY]: freshly.length,
          });
          if (!live) return;
        }

        setPrefs(storedPrefs);
        // A silent hash means "wherever you were" — first run lands on welcome.
        if (!window.location.hash) setView(storedPrefs.welcomeSeen ? 'reciters' : 'welcome');
        setRows(roster);
        setHeld(storedHeld);
        setSettings(storedSettings);
        setPaused(storedSettings.paused);
        setUploadDraft(String(storedSettings.uploadMbps));
        // The picker is the manual surface only: a follow row is held but not
        // chosen, and treating it as chosen would let the next save delete it.
        setSelected(new Set(storedHeld.filter((reciter) => reciter.source === 'manual').map((reciter) => reciter.infohash)));
        if (estimate?.quota) setDisk({ quota: estimate.quota, usage: estimate.usage ?? 0 });
        setLoading(false);
      },
      () => {
        if (!live) return;
        setFailed(true);
        setLoading(false);
      },
    );

    return () => {
      live = false;
    };
  }, [attempt]);

  const catalogueHashes = new Set(rows.map((reciter) => reciter.infohash));
  const heldHashes = new Set(held.map((reciter) => reciter.infohash));
  const unpublished = held.filter((reciter) => !catalogueHashes.has(reciter.infohash));
  const chosen = rows.filter((reciter) => selected.has(reciter.infohash));
  const ordered = sortReciters(filterByRiwaya(rows, prefs.riwayat), prefs.sort, lang);
  const mine = rows.filter((reciter) => selected.has(reciter.infohash));
  /** Held because the site said so; hidden from the picker's selection. */
  const follow = held.filter(
    (reciter) => reciter.source === 'follow' && !selected.has(reciter.infohash),
  );

  const unknownSize =
    chosen.some((reciter) => typeof reciter.sizeBytes !== 'number' || reciter.sizeBytes <= 0) ||
    unpublished.some((reciter) => typeof reciter.sizeBytes !== 'number' || reciter.sizeBytes <= 0);

  const addBytes = chosen
    .filter((reciter) => !heldHashes.has(reciter.infohash))
    .reduce((sum, reciter) => sum + (reciter.sizeBytes ?? 0), 0);
  const selectedBytes = chosen.reduce((sum, reciter) => sum + (reciter.sizeBytes ?? 0), 0);
  const publishedHeldBytes = held
    .filter((reciter) => catalogueHashes.has(reciter.infohash))
    .reduce((sum, reciter) => sum + (reciter.sizeBytes ?? 0), 0);

  const capReciters = settings?.maxReciters ?? 2;
  const plan = planSelection({
    selectedBytes: addBytes,
    selectedCount: chosen.length,
    unknownSize,
    maxReciters: capReciters,
    capBytes: disk?.quota ?? Number.POSITIVE_INFINITY,
    heldBytes: publishedHeldBytes,
    usageBytes: disk?.usage ?? null,
  });

  const refusal =
    plan.reason === 'count' ? copy.overCount : plan.reason === 'unknown' ? copy.overUnknown : copy.overDisk;

  useEffect(() => {
    void savePrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (!settings) return;
    // The first pass is the stored value arriving; saving it back is noise.
    if (!hydrated.current) {
      hydrated.current = true;
      return;
    }
    const timer = setTimeout(() => {
      void saveSettings({ ...settings, uploadMbps: parseUploadMbps(uploadDraft) }).then((saved) => {
        setSettings((current) => (current ? { ...current, uploadMbps: saved.uploadMbps } : current));
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [settings, uploadDraft]);

  const dismissFresh = async () => {
    if (fresh.length === 0) return;
    const nextSeen = markSeen(seen, fresh.map((reciter) => reciter.infohash));
    setSeen(nextSeen);
    setFresh([]);
    await browser.storage.local.set({ [NEW_SEEN_KEY]: nextSeen, [PENDING_KEY]: 0 });
  };

  const toggle = (infohash: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(infohash)) next.delete(infohash);
      else next.add(infohash);
      return next;
    });
    setStatus({ text: '', tone: 'idle' });
  };

  const addToHeld = (infohash: string) => {
    setSelected((current) => new Set(current).add(infohash));
    setFresh((current) => current.filter((row) => row.infohash !== infohash));
    setCapPrompt(null);
  };

  /** A ceiling that dead-ends teaches people to give up; offer the raise instead. */
  const addWithCap = (infohash: string) => {
    if (selected.size >= capReciters) {
      setCapPrompt(infohash);
      return;
    }
    addToHeld(infohash);
  };

  const raiseCapAndAdd = () => {
    if (!settings || !capPrompt) return;
    const next = { ...settings, maxReciters: Math.min(12, settings.maxReciters + 1) };
    setSettings(next);
    addToHeld(capPrompt);
  };

  const removeUnpublished = async (infohash: string) => {
    setHeld((current) => current.filter((reciter) => reciter.infohash !== infohash));
    await ask({ type: 'state:remove', infohash });
  };

  /** A follow row is removed for real, immediately — not at the next save. */
  const removeFollow = async (infohash: string) => {
    const next = held.filter((reciter) => reciter.infohash !== infohash);
    setHeld(next);
    await saveHeld(next);
    await ask({ type: 'state:remove', infohash });
  };

  const save = async () => {
    if (!settings || !plan.allowed) return;
    setSaving(true);
    setStatus({ text: copy.saving, tone: 'idle' });

    try {
      // The follow list passes through untouched: it is not the picker's to
      // rebuild, and the removal loop below must never see it as "dropped".
      const followKept = held.filter(
        (reciter) => reciter.source === 'follow' && !chosen.some((pick) => pick.infohash === reciter.infohash),
      );
      const next: HeldReciter[] = [
        ...unpublished,
        ...chosen.map((reciter) => {
          const prior = held.find((existing) => existing.infohash === reciter.infohash);
          return {
            ...reciter,
            addedAt: prior?.addedAt ?? new Date().toISOString(),
            // Ticking a row is a manual decision, even if follow had it first.
            source: 'manual' as const,
          };
        }),
        ...followKept,
      ];

      const nextHashes = new Set(next.map((reciter) => reciter.infohash));
      for (const reciter of held) {
        if (nextHashes.has(reciter.infohash)) continue;
        await ask({ type: 'state:remove', infohash: reciter.infohash });
      }

      const uploadMbps = parseUploadMbps(uploadDraft);
      await saveHeld(next);
      const saved = await saveSettings({ ...settings, uploadMbps });
      setSettings(saved);
      setUploadDraft(String(saved.uploadMbps));
      setHeld(next);

      setPaused(false);
      const reply = await ask({ type: 'state:start' });
      setStatus(reply.ok ? { text: copy.saved, tone: 'idle' } : { text: reply.error ?? copy.failed, tone: 'error' });
    } catch (error) {
      setStatus({ text: error instanceof Error ? error.message : String(error), tone: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="page" dir={copy.dir}>
      <header className="masthead">
        <img src="/icon/48.png" alt="" width={40} height={40} />
        <div className="title">
          <h1>{copy.title}</h1>
          <span className="meta">
            <bdi dir="ltr">{version}</bdi>
          </span>
        </div>
      </header>

      <p className="lede">{copy.lede}</p>

      {view !== 'welcome' ? (
      <Nav
        view={view}
        labels={{ label: copy.navLabel, reciters: copy.navReciters, settings: copy.navSettings, about: copy.navAbout }}
      />
      ) : null}

      {view === 'reciters' ? (
        <RecitersView
          copy={copy}
          loading={loading}
          failed={failed}
          rows={rows}
          ordered={ordered}
          fresh={fresh}
          unpublished={unpublished}
          mine={mine}
          follow={follow}
          mineOpen={prefs.mineOpen}
          rosterOpen={prefs.rosterOpen}
          sort={prefs.sort}
          riwayat={prefs.riwayat}
          onMineOpen={(open) => setPrefs((current) => ({ ...current, mineOpen: open }))}
          onRosterOpen={(open) => setPrefs((current) => ({ ...current, rosterOpen: open }))}
          onRetry={() => setAttempt((value) => value + 1)}
          onAdd={addWithCap}
          onDismissFresh={() => void dismissFresh()}
          onRemove={(infohash) =>
            setSelected((current) => {
              const next = new Set(current);
              next.delete(infohash);
              return next;
            })
          }
          onSort={(next) => setPrefs((current) => ({ ...current, sort: next }))}
          onRiwayat={(next) => setPrefs((current) => ({ ...current, riwayat: next }))}
          onRemoveUnpublished={(infohash) => void removeUnpublished(infohash)}
          onRemoveFollow={(infohash) => void removeFollow(infohash)}
        />
      ) : null}

      {view === 'settings' && settings ? (
        <SettingsView
          copy={copy}
          settings={settings}
          uploadDraft={uploadDraft}
          canReadBattery={canReadBattery}
          canReadConnection={canReadConnection}
          onSettings={setSettings}
          onUploadDraft={setUploadDraft}
        />
      ) : null}

      {view === 'about' ? <AboutView copy={copy} lang={lang} version={version} /> : null}

      {view === 'welcome' ? (
        <WelcomeView
          copy={copy}
          onDone={() => {
            setPrefs((current) => ({ ...current, welcomeSeen: true }));
            setView('reciters');
            if (!window.location.hash) window.location.hash = '#/reciters';
          }}
        />
      ) : null}

      {capPrompt ? (
        <div className="cap-offer" role="alertdialog" aria-live="polite">
          <span>{copy.raiseCapAsk.replace('{n}', String((settings?.maxReciters ?? 2) + 1))}</span>
          <button type="button" className="action" onClick={raiseCapAndAdd}>
            {copy.raiseCapYes}
          </button>
          <button type="button" className="quiet" onClick={() => setCapPrompt(null)}>
            {copy.raiseCapNo}
          </button>
        </div>
      ) : null}

      {view !== 'about' && view !== 'welcome' ? (
        <SummaryBar
          selectedCount={chosen.length}
          selectedBytes={selectedBytes}
          capReciters={capReciters}
          followCount={follow.length}
          allowed={plan.allowed}
          running={!paused && held.length > 0}
          refusal={refusal}
          status={status}
          busy={saving}
          labels={{ selected: copy.selectedLabel, cap: copy.capLabel, follow: copy.followCount, start: copy.start, pause: copy.pauseCta }}
          onPrimary={() => {
            if (!paused && held.length > 0) {
              setPaused(true);
              void ask({ type: 'state:pause' });
              return;
            }
            void save();
          }}
        />
      ) : null}

    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
