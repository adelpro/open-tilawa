import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { api } from '../lib/api';
import { useI18n, type MessageKey } from '../lib/i18n';
import { FoldPanel } from '../components/FoldPanel';
import { TrendBars } from '../components/TrendBars';
import { Notice } from '../components/Chip';
import { SkeletonRows } from '../components/Skeleton';
import { Icon } from '../components/icons';
import { shortDate, relative, bytes } from '../lib/format';
import { funnelRows, playedShare, returningDevices } from '../lib/usage-funnel';
import {
  DEFAULT_USAGE_RANGE,
  USAGE_RANGES,
  USAGE_RANGE_IDS,
  nextRange,
  parseUsageRange,
  periodStats,
  type UsageRange,
} from '../lib/usage-period';
import { readFolded, writeFolded, type Folded, type UsagePanel } from '../lib/usage-fold';
import { readTab, writeTab } from '../lib/tab-memory';
import {
  nextSort,
  reciterLabel,
  sortRows,
  sortVolume,
  summaryQuery,
  type Sort,
} from '../lib/usage-filters';
import { surahName } from '../lib/surahs';

type Summary = {
  surahs: { surah: number; plays: number; completes: number; bytes: number }[];
  reciters: { reciter: string; plays: number }[];
  sources: { torrent: number; webseed: number };
  reliability: { source: string; plays: number; errors: number; rate: number }[];
  errorsByVersion: { version: string; errors: number; plays: number; rate: number }[];
  recentErrors: {
    at: string;
    reciter: string;
    surah: number;
    source: string;
    errorCode: string | null;
    version: string;
  }[];
  volume: {
    serverBytes: number;
    torrentBytes: number;
    byReciter: { reciter: string; serverBytes: number; torrentBytes: number }[];
  };
  devices: { day: string; devices: number }[];
  listeners: { day: string; listeners: number }[];
  deviceAges: { day: string; age: string; devices: number }[];
  lastPrunedAt: string | null;
};

type Source = '' | 'torrent' | 'webseed';
type Filters = { source: Source; version: string; reciter: string };

/** What the catalogue contributes to a telemetry row: a name for the slug. */
type CatalogueName = { name: string; nameAr: string | null };
type CatalogueRow = CatalogueName & { slug: string };

const RANGE_LABEL: Record<UsageRange, MessageKey> = {
  7: 'usage.range7',
  30: 'usage.range30',
  90: 'usage.range90',
  // Past the raw retention the rollup answers, so the screen can offer a year.
  365: 'usage.range365',
};

/** Enough days to see a trend without turning one panel into the whole screen. */
const DEVICE_ROWS = 14;

/** Below this many attempts a rate is an accident of a small sample, not a signal. */
const LOW_SAMPLE = 20;

const EMPTY_FILTERS: Filters = { source: '', version: '', reciter: '' };

/**
 * What the listeners' own reports add up to.
 *
 * A read-out, not a control panel: nothing here turns collection on for anyone — consent
 * is the listener's act in the app — and the kill switch and the retention window stay
 * deployment settings, because a UI switch that silently stops ingest is how a week goes
 * missing unnoticed.
 *
 * The three ranges stop at ninety because that is the raw window; offering more would
 * promise data the prune has already removed.
 *
 * The filters are server-side on purpose. A client-side filter would leave "Most-played
 * surahs" and "Errors by version" showing unfiltered numbers while the control above says
 * otherwise — a filter that lies is worse than no filter. Each dimension panel ignores its
 * own filter (the source split keeps both sides while you narrow by source), which is the
 * comparison that panel exists for.
 */
export function Usage(): ReactElement {
  const { t, locale } = useI18n();
  /**
   * The chosen window is a preference, like the fold state and the Account tabs:
   * it belongs to this browser, so a reload opens on the range last read. The
   * stored value is validated on the way in — a range this build no longer
   * offers falls back to the default instead of leaving the screen blank.
   */
  const [days, setDaysState] = useState<UsageRange>(() =>
    parseUsageRange(readTab('usage', USAGE_RANGE_IDS, `${DEFAULT_USAGE_RANGE}`)),
  );
  const setDays = (value: UsageRange): void => {
    setDaysState(value);
    writeTab('usage', String(value));
  };
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);
  /** Every panel starts open; the stored value is a preference, not a default. */
  const [folded, setFolded] = useState<Folded>(readFolded);

  /** Fold is written as it is set, so a reload lands on the same page shape. */
  const togglePanel = (panel: UsagePanel): void => {
    const next = { ...folded, [panel]: !folded[panel] };
    setFolded(next);
    writeFolded(next);
  };

  const [surahSort, setSurahSort] = useState<Sort>({ key: 'plays', dir: 'desc' });
  const [reciterSort, setReciterSort] = useState<Sort>({ key: 'plays', dir: 'desc' });
  const [versionSort, setVersionSort] = useState<Sort>({ key: 'version', dir: 'desc' });
  const [errorSort, setErrorSort] = useState<Sort>({ key: 'at', dir: 'desc' });
  /**
   * The volume table opens on "most served", which is the order the API ranks by:
   * both figures combined. That key is never drawn — the panel shows the two
   * measurements apart — so no column claims the sort until one is clicked.
   */
  const [volumeSort, setVolumeSort] = useState<Sort>({ key: 'served', dir: 'desc' });

  /**
   * The catalogue, read for one reason: telemetry stores the slug the player
   * sent, and a slug is not a name. A failed read is not a failed report — the
   * tables keep showing slugs, exactly as they did before.
   */
  const [reciterNames, setReciterNames] = useState<ReadonlyMap<string, CatalogueName>>(new Map());

  useEffect(() => {
    let alive = true;
    api<CatalogueRow[]>('/reciters')
      .then((rows) => {
        if (!alive) return;
        const names = new Map<string, CatalogueName>();
        for (const row of rows) {
          if (row.slug) names.set(row.slug, { name: row.name, nameAr: row.nameAr });
        }
        setReciterNames(names);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const labelFor = useCallback(
    (slug: string) => reciterLabel({ reciter: slug, ...reciterNames.get(slug) }),
    [reciterNames],
  );

  const load = useCallback(async () => {
    setError(false);
    try {
      // `api()` prefixes `/api`; the path here is what follows it.
      setSummary(await api<Summary>(summaryQuery(days, filters)));
    } catch {
      setError(true);
    }
  }, [days, filters]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = summary ? summary.sources.torrent + summary.sources.webseed : 0;
  const share = (value: number): number => (total === 0 ? 0 : Math.round((value / total) * 100));
  const filtered = Boolean(filters.source || filters.version || filters.reciter);

  /**
   * A sortable column header. `aria-sort` is what tells a screen reader the table
   * is ordered, so the arrow is decoration and the attribute is the fact.
   */
  const sortHeader = (
    label: string,
    sort: Sort,
    set: (next: Sort) => void,
    key: string,
  ): ReactElement => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className="th-sort" onClick={() => set(nextSort(sort, key))}>
          {label}
          {active ? <Icon name={sort.dir === 'asc' ? 'up' : 'down'} /> : null}
        </button>
      </th>
    );
  };

  /**
   * The window's own start, so "7" is a date and not a number nobody can place.
   * Seven days ending today start six days back — the same anchor the API uses,
   * or the header would name a date the panel does not read from.
   */
  const from = shortDate(new Date(Date.now() - (days - 1) * 86_400_000).toISOString(), locale);

  /** The one range the empty state can offer; null at the widest window. */
  const wider = nextRange(days);

  const surahs = useMemo(
    () =>
      sortRows(
        summary?.surahs ?? [],
        {
          surah: (a, b) => a.surah - b.surah,
          plays: (a, b) => a.plays - b.plays,
          completes: (a, b) => a.completes - b.completes,
          bytes: (a, b) => a.bytes - b.bytes,
        },
        surahSort,
      ),
    [summary, surahSort],
  );

  const reciters = useMemo(
    () =>
      sortRows(
        summary?.reciters ?? [],
        {
          reciter: (a, b) => labelFor(a.reciter).localeCompare(labelFor(b.reciter), locale),
          plays: (a, b) => a.plays - b.plays,
        },
        reciterSort,
      ),
    [summary, reciterSort, locale, labelFor],
  );

  const versions = useMemo(
    () =>
      sortRows(
        summary?.errorsByVersion ?? [],
        {
          version: (a, b) => a.version.localeCompare(b.version),
          errors: (a, b) => a.errors - b.errors,
          plays: (a, b) => a.plays - b.plays,
          rate: (a, b) => a.rate - b.rate,
        },
        versionSort,
      ),
    [summary, versionSort],
  );

  const recentErrors = useMemo(
    () =>
      sortRows(
        summary?.recentErrors ?? [],
        {
          at: (a, b) => Date.parse(a.at) - Date.parse(b.at),
          version: (a, b) => a.version.localeCompare(b.version),
          reciter: (a, b) => labelFor(a.reciter).localeCompare(labelFor(b.reciter), locale),
          surah: (a, b) => a.surah - b.surah,
          errorCode: (a, b) => (a.errorCode ?? '').localeCompare(b.errorCode ?? ''),
        },
        errorSort,
      ),
    [summary, errorSort, locale, labelFor],
  );

  const volumeRows = useMemo(
    () =>
      sortVolume(
        (summary?.volume.byReciter ?? []).map((row) => {
          const names = reciterNames.get(row.reciter);
          return names ? { ...row, ...names } : row;
        }),
        volumeSort,
        locale,
      ),
    [summary, volumeSort, locale, reciterNames],
  );

  /**
   * The funnel, oldest day first, trimmed to something a panel can hold.
   *
   * `funnelRows` is where the two counters meet: a day one of them missed is
   * still a day, and the share is null — not zero — when nothing opened the app.
   */
  const funnel = useMemo(
    () => funnelRows(summary?.devices ?? [], summary?.listeners ?? []).slice(-DEVICE_ROWS),
    [summary],
  );
  // The newest row can be yesterday's if nobody has reported today; the header
  // claims "today", so it must read today or say nothing.
  const today = new Date().toISOString().slice(0, 10);
  const returning = useMemo(() => returningDevices(summary?.deviceAges ?? []), [summary]);

  /**
   * The window, not only today. Two separate series, so two separate read-outs:
   * the days each one reported, its busiest day, its average over the days that
   * did report, and the newest report — which can be yesterday or older.
   *
   * Never a total: a daily row counts devices, not days, so adding the rows
   * would report one phone once for every day it opened the app.
   */
  const openedPeriod = useMemo(
    () =>
      periodStats((summary?.devices ?? []).map((row) => ({ day: row.day, count: row.devices }))),
    [summary],
  );
  const playedPeriod = useMemo(
    () =>
      periodStats(
        (summary?.listeners ?? []).map((row) => ({ day: row.day, count: row.listeners })),
      ),
    [summary],
  );

  const todayRow = funnel.find((row) => row.day === today);
  const reportedToday = todayRow?.devices ?? 0;
  const listenedToday = todayRow?.listeners ?? 0;
  const maxSurahPlays = surahs.reduce((max, row) => Math.max(max, row.plays), 0);

  const empty =
    summary !== null &&
    versions.length === 0 &&
    recentErrors.length === 0 &&
    total === 0 &&
    summary.volume.serverBytes === 0 &&
    summary.volume.torrentBytes === 0 &&
    summary.devices.length === 0;

  return (
    <div className="stack">
      <header className="spread">
        <div>
          <h1 className="title">{t('usage.title')}</h1>
          <p className="muted">{t('usage.window', { days: String(days), date: from })}</p>
        </div>
        <div className="usage-range">
          {/* One control per shape. Four Arabic labels and a 34px target do not fit at
              375px, so a phone gets the native picker and the segments stay for wider
              screens. Only one of the two is ever displayed, so only one is announced. */}
          <select
            className="usage-range__select field__select"
            aria-label={t('usage.range')}
            value={days}
            onChange={(event) => setDays(parseUsageRange(event.target.value))}
          >
            {USAGE_RANGES.map((value) => (
              <option key={value} value={value}>
                {t(RANGE_LABEL[value])}
              </option>
            ))}
          </select>
          <div className="segmented" role="group" aria-label={t('usage.range')}>
            {USAGE_RANGES.map((value) => (
              <button
                key={value}
                type="button"
                className="segmented__item"
                aria-pressed={value === days}
                onClick={() => setDays(value)}
              >
                {t(RANGE_LABEL[value])}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="cluster" role="group" aria-label={t('usage.filters')}>
        <select
          className="field__select"
          aria-label={t('usage.source')}
          value={filters.source}
          onChange={(event) =>
            setFilters((current) => ({ ...current, source: event.target.value as Source }))
          }
        >
          <option value="">{t('usage.allSources')}</option>
          <option value="torrent">{t('usage.torrent')}</option>
          <option value="webseed">{t('usage.webseed')}</option>
        </select>

        <select
          className="field__select"
          aria-label={t('usage.version')}
          value={filters.version}
          onChange={(event) =>
            setFilters((current) => ({ ...current, version: event.target.value }))
          }
        >
          <option value="">{t('usage.allVersions')}</option>
          {versions.map((row) => (
            <option key={row.version} value={row.version}>
              {row.version}
            </option>
          ))}
          {/* A chosen version the current window no longer holds: keep it selectable
              rather than letting the control fall back to "all" silently. */}
          {filters.version !== '' && !versions.some((row) => row.version === filters.version) ? (
            <option value={filters.version}>{filters.version}</option>
          ) : null}
        </select>

        <select
          className="field__select"
          aria-label={t('usage.reciter')}
          value={filters.reciter}
          onChange={(event) =>
            setFilters((current) => ({ ...current, reciter: event.target.value }))
          }
        >
          <option value="">{t('usage.allReciters')}</option>
          {reciters.map((row) => (
            <option key={row.reciter} value={row.reciter}>
              {labelFor(row.reciter)}
            </option>
          ))}
          {filters.reciter !== '' && !reciters.some((row) => row.reciter === filters.reciter) ? (
            <option value={filters.reciter}>{labelFor(filters.reciter)}</option>
          ) : null}
        </select>

        {filtered ? (
          <button type="button" className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>
            {t('usage.clearFilters')}
          </button>
        ) : null}
      </div>

      {error && (
        <Notice tone="bad">
          {t('usage.error')}{' '}
          {/* The failure is a state someone can leave: the retry asks the same
              question again rather than making them reload the whole screen. */}
          <button type="button" className="btn" onClick={() => void load()}>
            {t('usage.retry')}
          </button>
        </Notice>
      )}

      {!summary && !error && <SkeletonRows rows={5} label={t('usage.loading')} />}

      {empty && (
        <div className="empty" role="status">
          <p>
            {filtered
              ? t('usage.emptyFiltered')
              : t('usage.emptyWindow', { days: String(days) })}
          </p>
          {/* A window with nothing in it still has a history: saying when the last
              report arrived turns "0" into "you are looking too narrowly". */}
          {openedPeriod.latest ? (
            <p className="muted">
              {t('usage.emptyHint', { date: shortDate(openedPeriod.latest.day, locale) })}
            </p>
          ) : null}
          {/* One way out, and only when there is one: a filtered screen already
              carries "Clear filters" in the bar above. */}
          {!filtered && wider !== null ? (
            <button type="button" className="btn" onClick={() => setDays(wider)}>
              {t('usage.widen', { days: String(wider) })}
            </button>
          ) : null}
        </div>
      )}

      {summary && !empty && (
        <>
          {/* The three facts worth seeing without unfolding a panel. The numbers are
              already below, inside collapsible tables nobody opens to check the pipe. */}
          <section className="usage-today">
            <div className="usage-today__tile">
              <span className="usage-today__n">{reportedToday}</span>
              <span className="usage-today__l">{t('usage.devicesCount')}</span>
            </div>
            <div className="usage-today__tile">
              <span className="usage-today__n">{listenedToday}</span>
              <span className="usage-today__l">{t('usage.listenersCount')}</span>
            </div>
            <div className="usage-today__tile">
              <span className="usage-today__n">
                {openedPeriod.latest ? shortDate(openedPeriod.latest.day, locale) : '—'}
              </span>
              <span className="usage-today__l">{t('usage.periodLast')}</span>
            </div>
          </section>

          <FoldPanel
            title={t('usage.surahs')}
            open={!folded.surahs}
            onToggle={() => togglePanel('surahs')}
          >
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.surah'), surahSort, setSurahSort, 'surah')}
                    {sortHeader(t('usage.plays'), surahSort, setSurahSort, 'plays')}
                    {sortHeader(t('usage.completes'), surahSort, setSurahSort, 'completes')}
                    <th scope="col">{t('usage.share')}</th>
                    {sortHeader(t('usage.serverBytes'), surahSort, setSurahSort, 'bytes')}
                  </tr>
                </thead>
                <tbody>
                  {surahs.map((row) => (
                    <tr key={row.surah}>
                      <td>
                        <SurahCell id={row.surah} />
                      </td>
                      <td className="num">{row.plays}</td>
                      {/* A play says sound started; this says it reached the end. The
                          pair is the only honest completion figure on the screen. */}
                      <td className="num">{row.completes}</td>
                      <td>
                        {/* The count beside it is the fact; the bar is decoration, so it
                            is hidden from a screen reader rather than read as content. */}
                        <span className="share" aria-hidden="true">
                          <span
                            className="share__fill"
                            style={{
                              inlineSize: `${maxSurahPlays === 0 ? 0 : (row.plays / maxSurahPlays) * 100}%`,
                            }}
                          />
                        </span>
                      </td>
                      <td className="num">{bytes(row.bytes, locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered ? <p className="muted">{t('usage.bytesNote')}</p> : null}
          </FoldPanel>

          <FoldPanel
            title={t('usage.reciters')}
            open={!folded.reciters}
            onToggle={() => togglePanel('reciters')}
          >
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.reciter'), reciterSort, setReciterSort, 'reciter')}
                    {sortHeader(t('usage.plays'), reciterSort, setReciterSort, 'plays')}
                  </tr>
                </thead>
                <tbody>
                  {reciters.map((row) => (
                    <tr key={row.reciter}>
                      <td>
                        <bdi>{labelFor(row.reciter)}</bdi>
                      </td>
                      <td className="num">{row.plays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FoldPanel>

          <FoldPanel
            title={t('usage.source')}
            open={!folded.source}
            onToggle={() => togglePanel('source')}
          >
            <div className="table-scroll">
              <table className="table table--stacked">
                <thead>
                  <tr>
                    <th scope="col" aria-hidden="true" />
                    <th scope="col">{t('usage.plays')}</th>
                    <th scope="col">{t('usage.share')}</th>
                    <th scope="col">{t('usage.errorsCount')}</th>
                    <th scope="col">{t('usage.rate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Both sources, always: this table *is* the comparison, so it
                      keeps its own dimension while the source filter narrows the
                      rest of the screen. */}
                  {summary.reliability.map((row) => {
                    const attempts = row.plays + row.errors;
                    const small = attempts < LOW_SAMPLE;
                    return (
                      <tr key={row.source}>
                        <td>
                          {row.source === 'torrent' ? t('usage.torrent') : t('usage.webseed')}
                        </td>
                        <td className="num" data-label={t('usage.plays')}>
                          {row.plays}
                        </td>
                        <td className="num" data-label={t('usage.share')}>
                          {share(row.plays)}%
                        </td>
                        <td className="num" data-label={t('usage.errorsCount')}>
                          {row.errors}
                        </td>
                        <td
                          className="num"
                          data-label={t('usage.rate')}
                          title={small ? t('usage.lowSample') : undefined}
                        >
                          {small ? '—' : `${Math.round(row.rate * 1000) / 10}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted">{t('usage.countsNote')}</p>
            <p className="muted">{t('usage.rateNote')}</p>
          </FoldPanel>

          <FoldPanel
            title={t('usage.volume')}
            open={!folded.volume}
            onToggle={() => togglePanel('volume')}
          >
            <p className="spread">
              <span>
                {t('usage.webseed')} ({t('usage.exact')}):{' '}
                {bytes(summary.volume.serverBytes, locale)}
              </span>
              <span>
                {t('usage.torrent')} ({t('usage.approx')}):{' '}
                {bytes(summary.volume.torrentBytes, locale)}
              </span>
            </p>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.reciter'), volumeSort, setVolumeSort, 'reciter')}
                    {sortHeader(t('usage.serverBytes'), volumeSort, setVolumeSort, 'serverBytes')}
                    {sortHeader(t('usage.torrent'), volumeSort, setVolumeSort, 'torrentBytes')}
                  </tr>
                </thead>
                <tbody>
                  {volumeRows.map((row) => (
                    <tr key={row.reciter}>
                      <td>
                        <bdi>{labelFor(row.reciter)}</bdi>
                      </td>
                      <td className="num">
                        {row.serverBytes === 0 ? '—' : bytes(row.serverBytes, locale)}
                      </td>
                      <td className="num">
                        {row.torrentBytes === 0 ? '—' : bytes(row.torrentBytes, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">{t('usage.volumeNote')}</p>
          </FoldPanel>

          <FoldPanel
            title={t('usage.devices')}
            open={!folded.devices}
            onToggle={() => togglePanel('devices')}
          >
            <p>{t('usage.devicesToday', { count: String(reportedToday) })}</p>
            <p>{t('usage.listeners', { count: String(listenedToday) })}</p>
            {returning ? (
              <>
                <p>
                  {t('usage.returning')}:{' '}
                  {t('usage.returningOf', {
                    returning: String(returning.returning),
                    known: String(returning.known),
                  })}
                </p>
                <p className="muted">{t('usage.returningNote')}</p>
              </>
            ) : null}

            <p className="muted">{t('usage.periodNote')}</p>
            <div className="table-scroll">
              <table className="table table--stacked">
                <thead>
                  <tr>
                    <th scope="col">{t('usage.periodMeasure')}</th>
                    <th scope="col">{t('usage.periodDays')}</th>
                    <th scope="col">{t('usage.periodBest')}</th>
                    <th scope="col">{t('usage.periodAverage')}</th>
                    <th scope="col">{t('usage.periodLast')}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: t('usage.periodOpened'), stats: openedPeriod },
                    { label: t('usage.periodPlayed'), stats: playedPeriod },
                  ].map(({ label, stats }) => (
                    <tr key={label}>
                      <td>{label}</td>
                      {/* Reported days out of the selected window: a bare count
                          here read as devices, next to "Opened the app". */}
                      <td className="num" data-label={t('usage.periodDays')}>
                        {stats.days} / {days}
                      </td>
                      <td data-label={t('usage.periodBest')}>
                        {stats.best
                          ? `${stats.best.count} · ${shortDate(stats.best.day, locale)}`
                          : '—'}
                      </td>
                      <td className="num" data-label={t('usage.periodAverage')}>
                        {stats.days === 0 ? '—' : stats.average}
                      </td>
                      <td data-label={t('usage.periodLast')}>
                        {stats.latest ? shortDate(stats.latest.day, locale) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TrendBars rows={funnel} />
            <div className="table-scroll">
              <table className="table table--stacked">
                <thead>
                  <tr>
                    <th scope="col">{t('usage.when')}</th>
                    <th scope="col">{t('usage.devicesCount')}</th>
                    <th scope="col">{t('usage.listenersCount')}</th>
                    <th scope="col">{t('usage.playedShare')}</th>
                    <th scope="col" aria-hidden="true" />
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((row) => {
                    // A day with no opening devices has no share at all: 0% would
                    // read as "everyone left", which is a claim nothing supports.
                    const share = playedShare(row.listeners, row.devices);
                    return (
                      <tr key={row.day}>
                        <td title={shortDate(row.day, locale)}>{row.day.slice(5)}</td>
                        <td className="num" data-label={t('usage.devicesCount')}>
                          {row.devices}
                        </td>
                        <td className="num" data-label={t('usage.listenersCount')}>
                          {row.listeners}
                        </td>
                        <td className="num" data-label={t('usage.playedShare')}>
                          {share === null ? '—' : `${Math.round(share * 100)}%`}
                        </td>
                        <td>
                          <span className="share" aria-hidden="true">
                            <span
                              className="share__fill"
                              style={{ inlineSize: `${share === null ? 0 : share * 100}%` }}
                            />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted">{t('usage.funnelNote')}</p>
            {filtered ? <p className="muted">{t('usage.devicesNoFilters')}</p> : null}
          </FoldPanel>

          <FoldPanel
            title={t('usage.errors')}
            open={!folded.errors}
            onToggle={() => togglePanel('errors')}
          >
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.version'), versionSort, setVersionSort, 'version')}
                    {sortHeader(t('usage.errorsCount'), versionSort, setVersionSort, 'errors')}
                    {sortHeader(t('usage.plays'), versionSort, setVersionSort, 'plays')}
                    {sortHeader(t('usage.rate'), versionSort, setVersionSort, 'rate')}
                  </tr>
                </thead>
                <tbody>
                  {versions.map((row) => {
                    const attempts = row.errors + row.plays;
                    const small = attempts < LOW_SAMPLE;
                    return (
                      <tr key={row.version}>
                        <td>{row.version}</td>
                        <td className="num">{row.errors}</td>
                        <td className="num">{row.plays}</td>
                        <td className="num" title={small ? t('usage.lowSample') : undefined}>
                          {small ? '—' : `${Math.round(row.rate * 1000) / 10}%`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="muted">{t('usage.rateNote')}</p>
          </FoldPanel>

          <FoldPanel
            title={t('usage.recent')}
            open={!folded.recent}
            onToggle={() => togglePanel('recent')}
          >
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.when'), errorSort, setErrorSort, 'at')}
                    {sortHeader(t('usage.version'), errorSort, setErrorSort, 'version')}
                    {sortHeader(t('usage.reciter'), errorSort, setErrorSort, 'reciter')}
                    {sortHeader(t('usage.surah'), errorSort, setErrorSort, 'surah')}
                    {sortHeader(t('usage.errorCode'), errorSort, setErrorSort, 'errorCode')}
                  </tr>
                </thead>
                <tbody>
                  {recentErrors.map((row, index) => (
                    <tr key={`${row.at}-${index}`}>
                      <td title={shortDate(row.at, locale)}>{relative(row.at, locale)}</td>
                      <td>{row.version}</td>
                      <td>
                        <bdi>{labelFor(row.reciter)}</bdi>
                      </td>
                      <td>
                        <SurahCell id={row.surah} />
                      </td>
                      <td>{row.errorCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              {t('usage.lastPruned')} {summary.lastPrunedAt ?? '—'}
            </p>
            <p className="muted">{t('usage.pruneNote')}</p>
          </FoldPanel>
        </>
      )}
    </div>
  );
}

/**
 * A surah in a table cell: the id then its name in the interface language.
 *
 * The id leads because it is the stored value and the sort key; the name is what
 * an operator actually recognises. Arabic text is isolated from the surrounding
 * direction; the English romanisation is read left to right.
 */
function SurahCell({ id }: { id: number }): ReactElement {
  const { locale } = useI18n();
  return (
    <>
      <bdi>{id}</bdi>
      <span className="muted" lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        {' · '}
        <bdi>{surahName(id, locale) ?? '—'}</bdi>
      </span>
    </>
  );
}
