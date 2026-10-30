import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Panel } from '../components/Panel';
import { Notice } from '../components/Chip';
import { SkeletonRows } from '../components/Skeleton';

type Summary = {
  surahs: { surah: number; plays: number }[];
  sources: { torrent: number; webseed: number };
  errorsByVersion: { version: string; rate: number }[];
  recentErrors: { at: string; reciter: string; surah: number; source: string; errorCode: string | null; version: string }[];
  lastPrunedAt: string | null;
};

const RANGES = [7, 30, 90] as const;

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
 */
export function Usage(): ReactElement {
  const { t } = useI18n();
  const [days, setDays] = useState<(typeof RANGES)[number]>(7);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      // `api()` prefixes `/api`; the path here is what follows it.
      setSummary(await api<Summary>(`/admin/telemetry/summary?days=${days}`));
    } catch {
      setError(true);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = summary ? summary.sources.torrent + summary.sources.webseed : 0;
  const share = (value: number): number => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <div className="stack">
      <header className="row row--between">
        <h1 className="title">{t('usage.title')}</h1>
        <div className="row">
          {RANGES.map((value) => (
            <button
              key={value}
              type="button"
              className={value === days ? 'btn btn--primary' : 'btn'}
              onClick={() => setDays(value)}
            >
              {`${value}`}
            </button>
          ))}
        </div>
      </header>

      {error && <Notice tone="bad">{t('usage.error')}</Notice>}

      {!summary && !error && <SkeletonRows rows={5} label={t('usage.loading')} />}

      {summary && total === 0 && (
        <Notice tone="info">{t('usage.empty')}</Notice>
      )}

      {summary && total > 0 && (
        <>
          <Panel>
            <h2 className="panel__title">{t('usage.surahs')}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('usage.surah')}</th>
                  <th scope="col">{t('usage.plays')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.surahs.map((row) => (
                  <tr key={row.surah}>
                    <td>{row.surah}</td>
                    <td>{row.plays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.source')}</h2>
            <p>
              {t('usage.torrent')} {share(summary.sources.torrent)}% · {t('usage.webseed')}{' '}
              {share(summary.sources.webseed)}%
            </p>
            <p className="muted">{t('usage.byteNote')}</p>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.errors')}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('usage.version')}</th>
                  <th scope="col">{t('usage.rate')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.errorsByVersion.map((row) => (
                  <tr key={row.version}>
                    <td>{row.version}</td>
                    <td>{Math.round(row.rate * 1000) / 10}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <Panel>
            <h2 className="panel__title">{t('usage.recent')}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('usage.version')}</th>
                  <th scope="col">{t('usage.surah')}</th>
                  <th scope="col">{t('usage.errorCode')}</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentErrors.map((row, index) => (
                  <tr key={`${row.at}-${index}`}>
                    <td>{row.version}</td>
                    <td>{row.surah}</td>
                    <td>{row.errorCode ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="muted">
              {t('usage.lastPruned')} {summary.lastPrunedAt ?? '—'}
            </p>
          </Panel>
        </>
      )}
    </div>
  );
}
