import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { navigate, linkProps } from '../lib/router';
import { Button } from '../components/Button';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import type { Turn, TurnCheck } from '../lib/types-seeders';

/**
 * One TURN server, with its probe history on its own route.
 *
 * The list screen answers "which nodes are healthy"; this screen answers "what
 * happened to this node" — so the history lives here rather than unfolding under
 * every row of the list.
 */
export function TurnDetail({ id }: { id: number }): ReactElement {
  const { t, locale } = useI18n();
  const [turn, setTurn] = useState<Turn | null>(null);
  const [missing, setMissing] = useState(false);
  const [checks, setChecks] = useState<TurnCheck[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [row, history] = await Promise.all([
        api<Turn>(`/turns/${id}`),
        api<TurnCheck[]>(`/turns/${id}/history?limit=50`),
      ]);
      setTurn(row);
      setChecks(history);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : t('turns.detailFailed');
      if (/not found/i.test(message)) setMissing(true);
      else setError(message);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function probe(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const updated = await api<Turn>(`/turns/${id}/poll`, { method: 'POST' });
      setTurn(updated);
      setChecks(await api<TurnCheck[]>(`/turns/${id}/history?limit=50`));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.pollFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await api(`/turns/${id}`, { method: 'DELETE' });
      navigate('/turns');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.removeFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (missing) {
    return (
      <div className="stack">
        <Notice tone="bad">{t('turns.notFound')}</Notice>
        <div>
          <a className="btn btn--secondary" {...linkProps('/turns')}>
            {t('turns.back')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <a className="fine-print" {...linkProps('/turns')}>
            ← {t('turns.back')}
          </a>
          <h1 className="display-lg">{turn?.name ?? t('turns.loading')}</h1>
          <p className="body muted">{turn?.url ?? ''}</p>
        </div>
        <div className="cluster">
          <Button variant="secondary" onClick={() => void probe()} busy={busy}>
            {t('turns.poll')}
          </Button>
          <Button variant="destructive" onClick={() => void remove()} busy={busy}>
            {t('turns.remove')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      {turn ? (
        <Panel>
          <div className="cluster">
            <Chip
              tone={turn.status === 'online' ? 'ok' : turn.status === 'offline' ? 'bad' : 'notice'}
            >
              {t(
                turn.status === 'online'
                  ? 'turns.statusOnline'
                  : turn.status === 'offline'
                    ? 'turns.statusOffline'
                    : 'turns.statusUnknown',
              )}
            </Chip>
            <span className="body">
              {t('turns.latency')}:{' '}
              {turn.latencyMs === null ? t('turns.latencyUnknown') : `${turn.latencyMs} ms`}
            </span>
            <span className="body muted">
              {t('turns.lastSeen')}: {formatTimestamp(turn.lastSeen, locale) ?? t('turns.never')}
            </span>
          </div>
        </Panel>
      ) : null}

      <h2 className="group-title">{t('turns.history')}</h2>
      {checks === null ? (
        <SkeletonRows rows={4} label={t('turns.historyLoading')} />
      ) : checks.length === 0 ? (
        <Panel>
          <p className="body muted">{t('turns.historyEmpty')}</p>
        </Panel>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('turns.checkedAt')}</th>
                  <th scope="col">{t('turns.statusHeading')}</th>
                  <th scope="col">{t('turns.latency')}</th>
                  <th scope="col">{t('turns.detail')}</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((check, index) => (
                  <tr key={`${check.checkedAt}-${index}`}>
                    <td>{formatTimestamp(check.checkedAt, locale)}</td>
                    <td>
                      <Chip tone={check.ok ? 'ok' : 'bad'}>
                        {t(check.ok ? 'turns.statusOnline' : 'turns.statusOffline')}
                      </Chip>
                    </td>
                    <td className="num">
                      {check.latencyMs === null
                        ? t('turns.latencyUnknown')
                        : `${check.latencyMs} ms`}
                    </td>
                    <td>{check.detail ?? t('turns.noDetail')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/**
 * SQLite's `datetime('now')` is `YYYY-MM-DD HH:MM:SS` in UTC with no zone
 * marker; read as local time it is off by the operator's offset.
 */
function formatTimestamp(value: string | null, locale: string): string | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}
