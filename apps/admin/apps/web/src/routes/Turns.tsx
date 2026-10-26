import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import type { Turn } from '../lib/types-seeders';

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
  const { t } = useI18n();
  const [turns, setTurns] = useState<Turn[] | null>(null);
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
                  <tr
                    key={turn.id}
                    className="table__row--clickable"
                    tabIndex={0}
                    role="link"
                    onClick={() => navigate(`/turns/${turn.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/turns/${turn.id}`);
                      }
                    }}
                  >
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
                    <td>{formatTimestamp(turn.lastSeen)}</td>
                    <td>
                      <span className="cluster cluster--end">
                        <Button
                          small
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            void poll(turn.id);
                          }}
                          busy={busy === `poll-${turn.id}`}
                        >
                          {t('turns.poll')}
                        </Button>
                        <Button
                          small
                          variant="destructive"
                          onClick={(event) => {
                            event.stopPropagation();
                            void remove(turn.id);
                          }}
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
    </div>
  );
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const iso = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
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
