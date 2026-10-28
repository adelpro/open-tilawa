import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { bytes } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import { ConfirmModal } from '../components/ConfirmModal';

interface ServiceOverview {
  id: number;
  name: string;
  url: string;
  ok: boolean | null;
  latencyMs: number | null;
  version: string | null;
  detail: string | null;
  lastCheckedAt: string | null;
  uptime24h: number | null;
  timeline: (number | null)[];
}

interface NodeRow {
  id: number;
  name: string;
  url: string;
  status: string;
  version: string | null;
  headroomBytes: number | null;
  lastSeen: string | null;
}

interface TurnRow {
  id: number;
  name: string;
  url: string;
  status: string;
  latencyMs: number | null;
  lastSeen: string | null;
  uptime24h: number | null;
  timeline: (number | null)[];
}

interface Overview {
  services: ServiceOverview[];
  seeders: NodeRow[];
  turns: TurnRow[];
}

/**
 * One page for the whole stack: each service's current state, its version and a
 * 24-hour timeline, plus the nodes and TURN servers that keep their own probes.
 *
 * The page never triggers the checks itself: a scheduler does that every five
 * minutes, so what is shown is history rather than "whatever loaded just now".
 * "Check now" exists for the moment an operator is looking at a red bar.
 */
export function Status(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ServiceOverview | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await api<Overview>('/status'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('status.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function checkNow(): Promise<void> {
    setBusy('check');
    setError(null);
    try {
      setOverview(await api<Overview>('/status/check', { method: 'POST' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('status.checkFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function addService(): Promise<void> {
    if (!name.trim() || !url.trim()) return;
    setBusy('add');
    setError(null);
    try {
      await api('/status/services', {
        method: 'POST',
        body: { name: name.trim(), url: url.trim() },
      });
      setName('');
      setUrl('');
      setShowAdd(false);
      setMessage(t('status.added'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('status.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function removeService(id: number): Promise<void> {
    setBusy(`remove-${id}`);
    setError(null);
    try {
      await api(`/status/services/${id}`, { method: 'DELETE' });
      setMessage(t('status.removed'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('status.removeFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <p className="body muted">{t('status.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('status.title')}</h1>
          <p className="body muted">{t('status.lede')}</p>
        </div>
        <div className="cluster">
          <Button variant="secondary" onClick={() => void checkNow()} busy={busy === 'check'}>
            {t('status.checkNow')}
          </Button>
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? t('status.cancel') : t('status.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {showAdd ? (
        <Panel>
          <div className="stack">
            <Field label={t('status.name')}>
              {(id) => (
                <Input id={id} value={name} onChange={(event) => setName(event.target.value)} />
              )}
            </Field>
            <Field label={t('status.url')} hint={t('status.urlHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/health"
                />
              )}
            </Field>
            <div className="cluster">
              <Button
                onClick={() => void addService()}
                busy={busy === 'add'}
                disabled={!name.trim() || !url.trim()}
              >
                {t('status.addSubmit')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {overview === null ? (
        <SkeletonRows rows={3} label={t('status.loading')} />
      ) : (
        <>
          <h2 className="group-title">{t('status.services')}</h2>
          <div className="grid grid--cards">
            {overview.services.map((service) => (
              <Panel key={service.id}>
                <div className="spread" style={{ marginBottom: 'var(--space-2)' }}>
                  <span className="row__label">{service.name}</span>
                  <Chip tone={service.ok === null ? 'notice' : service.ok ? 'ok' : 'bad'}>
                    {t(
                      service.ok === null
                        ? 'status.unknown'
                        : service.ok
                          ? 'status.ok'
                          : 'status.down',
                    )}
                  </Chip>
                </div>
                <p className="row__id">{service.url}</p>
                <p className="fine-print">
                  {service.version ? `v${service.version} · ` : ''}
                  {service.latencyMs !== null ? `${service.latencyMs} ms · ` : ''}
                  {t('status.uptime')}:{' '}
                  {service.uptime24h === null
                    ? t('status.noChecks')
                    : `${Math.round(service.uptime24h * 100)}%`}
                </p>
                <Timeline buckets={service.timeline} />
                <div className="cluster" style={{ marginTop: 'var(--space-2)' }}>
                  <Button
                    small
                    variant="tertiary"
                    onClick={() => setRemoving(service)}
                    busy={busy === `remove-${service.id}`}
                  >
                    {t('status.remove')}
                  </Button>
                </div>
              </Panel>
            ))}
          </div>

          <h2 className="group-title">{t('status.nodes')}</h2>
          <Panel>
            {overview.seeders.length === 0 ? (
              <p className="body muted">{t('status.noNodes')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('status.name')}</th>
                      <th scope="col">{t('status.state')}</th>
                      <th scope="col">{t('status.version')}</th>
                      <th scope="col">{t('status.headroom')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.seeders.map((node) => (
                      <tr key={node.id}>
                        <td>
                          <span className="row__label">{node.name}</span>
                          <br />
                          <span className="row__id">{node.url}</span>
                        </td>
                        <td>
                          <Chip
                            tone={
                              node.status === 'online'
                                ? 'ok'
                                : node.status === 'offline'
                                  ? 'bad'
                                  : 'notice'
                            }
                          >
                            {t(
                              node.status === 'online'
                                ? 'status.ok'
                                : node.status === 'offline'
                                  ? 'status.down'
                                  : 'status.unknown',
                            )}
                          </Chip>
                        </td>
                        <td>{node.version ? `v${node.version}` : '—'}</td>
                        <td className="num">{bytes(node.headroomBytes, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <h2 className="group-title">{t('status.turns')}</h2>
          <Panel>
            {overview.turns.length === 0 ? (
              <p className="body muted">{t('status.noTurns')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">{t('status.name')}</th>
                      <th scope="col">{t('status.state')}</th>
                      <th scope="col">{t('status.latency')}</th>
                      <th scope="col">{t('status.uptime')}</th>
                      <th scope="col">24h</th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview.turns.map((turn) => (
                      <tr key={turn.id}>
                        <td>
                          <span className="row__label">{turn.name}</span>
                          <br />
                          <span className="row__id">{turn.url}</span>
                        </td>
                        <td>
                          <Chip
                            tone={
                              turn.status === 'online'
                                ? 'ok'
                                : turn.status === 'offline'
                                  ? 'bad'
                                  : 'notice'
                            }
                          >
                            {t(
                              turn.status === 'online'
                                ? 'status.ok'
                                : turn.status === 'offline'
                                  ? 'status.down'
                                  : 'status.unknown',
                            )}
                          </Chip>
                        </td>
                        <td className="num">
                          {turn.latencyMs === null ? '—' : `${turn.latencyMs} ms`}
                        </td>
                        <td className="num">
                          {turn.uptime24h === null
                            ? t('status.noChecks')
                            : `${Math.round(turn.uptime24h * 100)}%`}
                        </td>
                        <td>
                          <Timeline buckets={turn.timeline} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
      {removing ? (
        <ConfirmModal
          title={t('status.removeTitle')}
          body={t('status.removeBody')}
          confirmLabel={t('status.removeConfirm')}
          destructive
          busy={busy === `remove-${removing.id}`}
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            void removeService(removing.id);
            setRemoving(null);
          }}
        />
      ) : null}
    </div>
  );
}

/** 24 hourly buckets, oldest first; an empty hour is a hairline, not a verdict. */
function Timeline({ buckets }: { buckets: (number | null)[] }): ReactElement {
  return (
    <div className="timeline" role="img" aria-label="24h">
      {buckets.map((ratio, index) => (
        <span
          key={index}
          className="timeline__bar"
          data-state={ratio === null ? 'empty' : ratio >= 1 ? 'up' : ratio > 0 ? 'partial' : 'down'}
        />
      ))}
    </div>
  );
}
