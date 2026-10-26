import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import type { Turn, TurnCheck } from '../lib/types-seeders';

/**
 * TURN servers, watched rather than merely listed.
 *
 * The scheduler probes every registered server over STUN on a five-minute beat;
 * this screen reads that record — status, last round-trip latency, and the
 * recent history — and offers the two manual verbs that still make sense
 * (probe now, remove). Adding is the same three-field form as the other
 * infrastructure screens.
 */
export function Turns(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [history, setHistory] = useState<Record<number, TurnCheck[] | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const load = useCallback(async () => {
    try {
      setTurns(await api<Turn[]>('/turns'));
    } catch (caught) {
      setTurns([]);
      setError(caught instanceof Error ? caught.message : t('turns.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(): Promise<void> {
    if (!newName.trim() || !newUrl.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await api('/turns', { method: 'POST', body: { name: newName.trim(), url: newUrl.trim() } });
      setNewName('');
      setNewUrl('');
      setShowAdd(false);
      setMessage(t('turns.added'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number): Promise<void> {
    setBusy(`remove-${id}`);
    setError(null);
    try {
      await api(`/turns/${id}`, { method: 'DELETE' });
      setMessage(t('turns.removed'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.removeFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function poll(id: number): Promise<void> {
    setBusy(`poll-${id}`);
    setError(null);
    try {
      await api(`/turns/${id}/poll`, { method: 'POST' });
      await load();
      if (history[id] !== undefined) await openHistory(id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function pollAll(): Promise<void> {
    setBusy('poll-all');
    setError(null);
    try {
      await api('/turns/poll-all', { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function openHistory(id: number): Promise<void> {
    if (history[id] !== undefined) {
      setHistory((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    try {
      const rows = await api<TurnCheck[]>(`/turns/${id}/history?limit=20`);
      setHistory((prev) => ({ ...prev, [id]: rows }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.historyFailed'));
    }
  }

  if (!user) return <p className="body muted">{t('turns.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('turns.title')}</h1>
          <p className="body muted">{t('turns.lede')}</p>
        </div>
        <div className="cluster">
          <Button variant="secondary" onClick={() => void pollAll()} busy={busy === 'poll-all'}>
            {t('turns.pollAll')}
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? t('turns.cancel') : t('turns.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {showAdd ? (
        <Panel>
          <div className="stack">
            <Field label={t('turns.name')}>
              {(id) => (
                <Input
                  id={id}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('turns.url')} hint={t('turns.urlHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newUrl}
                  onChange={(event) => setNewUrl(event.target.value)}
                  placeholder="turn:example.com:3478"
                />
              )}
            </Field>
            <div className="cluster">
              <Button
                onClick={() => void add()}
                busy={busy === 'add'}
                disabled={!newName.trim() || !newUrl.trim()}
              >
                {t('turns.addSubmit')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {turns === null ? (
        <SkeletonRows rows={3} label={t('turns.loading')} />
      ) : turns.length === 0 ? (
        <Panel>
          <p className="body muted">{t('turns.empty')}</p>
        </Panel>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('turns.name')}</th>
                  <th scope="col">{t('turns.statusHeading')}</th>
                  <th scope="col">{t('turns.latency')}</th>
                  <th scope="col">{t('turns.lastSeen')}</th>
                  <th scope="col">{t('turns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {turns.map((turn) => (
                  <tr key={turn.id}>
                    <td>
                      <span className="row__label">{turn.name}</span>
                      <br />
                      <span className="row__id">{turn.url}</span>
                    </td>
                    <td>
                      <Chip tone={statusTone(turn.status)}>{t(statusKey(turn.status))}</Chip>
                    </td>
                    <td className="num">
                      {turn.latencyMs === null ? t('turns.latencyUnknown') : `${turn.latencyMs} ms`}
                    </td>
                    <td>{formatTimestamp(turn.lastSeen, locale) ?? t('turns.never')}</td>
                    <td>
                      <span className="cluster cluster--end">
                        <Button
                          small
                          variant="secondary"
                          onClick={() => void poll(turn.id)}
                          busy={busy === `poll-${turn.id}`}
                        >
                          {t('turns.poll')}
                        </Button>
                        <Button small variant="tertiary" onClick={() => void openHistory(turn.id)}>
                          {t('turns.history')}
                        </Button>
                        <Button
                          small
                          variant="destructive"
                          onClick={() => void remove(turn.id)}
                          busy={busy === `remove-${turn.id}`}
                        >
                          {t('turns.remove')}
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {Object.entries(history).map(([id, rows]) => (
        <Panel key={`history-${id}`} tone="parchment">
          <h2 className="group-title">
            {t('turns.historyFor')} {turns?.find((turn) => turn.id === Number(id))?.name ?? id}
          </h2>
          {rows === null ? (
            <p className="body muted">{t('turns.historyLoading')}</p>
          ) : rows.length === 0 ? (
            <p className="body muted">{t('turns.historyEmpty')}</p>
          ) : (
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
                  {rows.map((check, index) => (
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
          )}
        </Panel>
      ))}
    </div>
  );
}

/**
 * SQLite's `datetime('now')` is `YYYY-MM-DD HH:MM:SS` in UTC with no zone
 * marker; read as local time it is off by the operator's offset, so mark it UTC
 * before formatting. Falls back to the raw string if it is not a date at all.
 */
function formatTimestamp(value: string | null, locale: string): string | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

function statusTone(status: Turn['status']): 'ok' | 'bad' | 'notice' {
  if (status === 'online') return 'ok';
  if (status === 'offline') return 'bad';
  return 'notice';
}

function statusKey(
  status: Turn['status'],
): 'turns.statusOnline' | 'turns.statusOffline' | 'turns.statusUnknown' {
  if (status === 'online') return 'turns.statusOnline';
  if (status === 'offline') return 'turns.statusOffline';
  return 'turns.statusUnknown';
}
