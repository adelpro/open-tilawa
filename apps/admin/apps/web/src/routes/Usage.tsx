import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';

import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Panel } from '../components/Panel';
import { Notice } from '../components/Chip';
import { SkeletonRows } from '../components/Skeleton';
import { Icon } from '../components/icons';
import { shortDate, relative } from '../lib/format';
import { nextSort, sortRows, summaryQuery, type Sort } from '../lib/usage-filters';

type Summary = {
  surahs: { surah: number; plays: number }[];
  reciters: { reciter: string; plays: number }[];
  sources: { torrent: number; webseed: number };
  errorsByVersion: { version: string; rate: number }[];
  recentErrors: {
    at: string;
    reciter: string;
    surah: number;
    source: string;
    errorCode: string | null;
    version: string;
  }[];
  lastPrunedAt: string | null;
};

type Source = '' | 'torrent' | 'webseed';
type Filters = { source: Source; version: string; reciter: string };

const RANGES = [7, 30, 90] as const;

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
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);

  const [surahSort, setSurahSort] = useState<Sort>({ key: 'plays', dir: 'desc' });
  const [reciterSort, setReciterSort] = useState<Sort>({ key: 'plays', dir: 'desc' });
  const [versionSort, setVersionSort] = useState<Sort>({ key: 'version', dir: 'desc' });
  const [errorSort, setErrorSort] = useState<Sort>({ key: 'at', dir: 'desc' });

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

  /** The window's own start, so "7" is a date and not a number nobody can place. */
  const from = shortDate(new Date(Date.now() - days * 86_400_000).toISOString(), locale);

  const surahs = useMemo(
    () =>
      sortRows(
        summary?.surahs ?? [],
        {
          surah: (a, b) => a.surah - b.surah,
          plays: (a, b) => a.plays - b.plays,
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
          reciter: (a, b) => a.reciter.localeCompare(b.reciter, locale),
          plays: (a, b) => a.plays - b.plays,
        },
        reciterSort,
      ),
    [summary, reciterSort, locale],
  );

  const versions = useMemo(
    () =>
      sortRows(
        summary?.errorsByVersion ?? [],
        {
          version: (a, b) => a.version.localeCompare(b.version),
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
          reciter: (a, b) => a.reciter.localeCompare(b.reciter, locale),
          surah: (a, b) => a.surah - b.surah,
          errorCode: (a, b) => (a.errorCode ?? '').localeCompare(b.errorCode ?? ''),
        },
        errorSort,
      ),
    [summary, errorSort, locale],
  );

  const empty = summary !== null && versions.length === 0 && recentErrors.length === 0 && total === 0;

  return (
    <div className="stack">
      <header className="row row--between">
        <h1 className="title">{t('usage.title')}</h1>
        <div className="cluster" role="group" aria-label={t('usage.range')}>
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              className={value === days ? 'btn btn--primary' : 'btn'}
              aria-pressed={value === days}
              onClick={() => setDays(value)}
            >
              {`${value}`}
            </button>
          ))}
        </div>
      </header>

      <p className="muted">{t('usage.window', { days: String(days), date: from })}</p>

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
              {row.reciter}
            </option>
          ))}
          {filters.reciter !== '' && !reciters.some((row) => row.reciter === filters.reciter) ? (
            <option value={filters.reciter}>{filters.reciter}</option>
          ) : null}
        </select>

        {filtered ? (
          <button type="button" className="btn" onClick={() => setFilters(EMPTY_FILTERS)}>
            {t('usage.clearFilters')}
          </button>
        ) : null}
      </div>

      {error && <Notice tone="bad">{t('usage.error')}</Notice>}

      {!summary && !error && <SkeletonRows rows={5} label={t('usage.loading')} />}

      {empty && (
        <Notice tone="info">
          {filtered ? t('usage.emptyFiltered') : t('usage.emptyWindow', { days: String(days) })}
        </Notice>
      )}

      {summary && !empty && (
        <>
          <Panel>
            <h2 className="panel__title">{t('usage.surahs')}</h2>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.surah'), surahSort, setSurahSort, 'surah')}
                    {sortHeader(t('usage.plays'), surahSort, setSurahSort, 'plays')}
                  </tr>
                </thead>
                <tbody>
                  {surahs.map((row) => (
                    <tr key={row.surah}>
                      <td>{row.surah}</td>
                      <td>{row.plays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.reciters')}</h2>
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
                      <td>{row.reciter}</td>
                      <td>{row.plays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.source')}</h2>
            <p>
              {t('usage.torrent')} {summary.sources.torrent} ({share(summary.sources.torrent)}%)
              {' · '}
              {t('usage.webseed')} {summary.sources.webseed} ({share(summary.sources.webseed)}%)
            </p>
            <p className="muted">{t('usage.countsNote')}</p>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.errors')}</h2>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    {sortHeader(t('usage.version'), versionSort, setVersionSort, 'version')}
                    {sortHeader(t('usage.rate'), versionSort, setVersionSort, 'rate')}
                  </tr>
                </thead>
                <tbody>
                  {versions.map((row) => (
                    <tr key={row.version}>
                      <td>{row.version}</td>
                      <td>{Math.round(row.rate * 1000) / 10}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.recent')}</h2>
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
                      <td>{row.reciter}</td>
                      <td>{row.surah}</td>
                      <td>{row.errorCode ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              {t('usage.lastPruned')} {summary.lastPrunedAt ?? '—'}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
