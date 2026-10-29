import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { relative } from '../lib/format';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Notice } from '../components/Chip';
import { NodeCard } from '../components/NodeCard';
import type { NodeMetric } from '../components/NodeCard';
import { Icon } from '../components/icons';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import { CopyLine } from '../components/CopyLine';
import { ConfirmModal } from '../components/ConfirmModal';
import { FormModal } from '../components/FormModal';
import { linkProps } from '../lib/router';
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
  const { t, locale } = useI18n();
  const [turns, setTurns] = useState<Turn[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newHost, setNewHost] = useState('');
  const [newPort, setNewPort] = useState('3478');
  const [newTransport, setNewTransport] = useState<'turn' | 'turns'>('turn');
  const [editing, setEditing] = useState<Turn | null>(null);
  const [removing, setRemoving] = useState<Turn | null>(null);
  const [editName, setEditName] = useState('');
  const [editHost, setEditHost] = useState('');
  const [editPort, setEditPort] = useState('3478');
  const [editTransport, setEditTransport] = useState<'turn' | 'turns'>('turn');
  const url = newHost.trim() ? `${newTransport}:${newHost.trim()}:${newPort.trim() || '3478'}` : '';

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
    if (!newName.trim() || !url) return;
    setBusy('add');
    setError(null);
    try {
      await api('/turns', { method: 'POST', body: { name: newName.trim(), url } });
      setNewName('');
      setNewHost('');
      setNewPort('3478');
      setNewTransport('turn');
      setShowAdd(false);
      setMessage(t('turns.added'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  function startEdit(turn: Turn): void {
    const { host, port, transport } = splitTurnUrl(turn.url);
    setEditing(turn);
    setEditName(turn.name);
    setEditHost(host);
    setEditPort(port);
    setEditTransport(transport);
    setError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editing) return;
    setBusy('edit');
    setError(null);
    try {
      await api(`/turns/${editing.id}`, {
        method: 'PATCH',
        body: {
          name: editName.trim(),
          url: `${editTransport}:${editHost.trim()}:${editPort.trim() || '3478'}`,
        },
      });
      setEditing(null);
      setMessage(t('turns.updated'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('turns.updateFailed'));
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
          <Button
            variant="secondary"
            icon={<Icon name="refresh" />}
            onClick={() => void pollAll()}
            busy={busy === 'poll-all'}
          >
            {t('turns.pollAll')}
          </Button>
          <Button icon={<Icon name="plus" />} onClick={() => setShowAdd(true)}>
            {t('turns.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {showAdd ? (
        <FormModal
          title={t('turns.add')}
          submitLabel={t('turns.addSubmit')}
          onSubmit={() => void add()}
          onClose={() => setShowAdd(false)}
          busy={busy === 'add'}
          disabled={!newName.trim() || !newHost.trim()}
        >
            <Field label={t('turns.name')}>
              {(id) => (
                <Input
                  id={id}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('turns.host')} hint={t('turns.hostHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newHost}
                  onChange={(event) => setNewHost(event.target.value)}
                  placeholder="turn.example.com"
                />
              )}
            </Field>
            <div className="cluster">
              <Field label={t('turns.transport')}>
                {(id) => (
                  <select
                    id={id}
                    className="field__select"
                    value={newTransport}
                    onChange={(event) => setNewTransport(event.target.value as 'turn' | 'turns')}
                  >
                    <option value="turn">{t('turns.transportPlain')}</option>
                    <option value="turns">{t('turns.transportTls')}</option>
                  </select>
                )}
              </Field>
              <Field label={t('turns.port')}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={newPort}
                    onChange={(event) => setNewPort(event.target.value)}
                  />
                )}
              </Field>
            </div>
            <div className="cluster">
              <Button
                small
                variant="tertiary"
                onClick={() => {
                  setNewTransport('turn');
                  setNewPort('3478');
                }}
              >
                {t('turns.presetStandard')}
              </Button>
              <Button
                small
                variant="tertiary"
                onClick={() => {
                  setNewTransport('turns');
                  setNewPort('5349');
                }}
              >
                {t('turns.presetTls')}
              </Button>
            </div>
            <p className="fine-print">
              {url ? t('turns.urlPreview', { url }) : t('turns.urlPreviewEmpty')}
            </p>

            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {t('turns.deployTitle')}
              </summary>
              <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
                <p className="body muted">{t('turns.deployHint')}</p>
                <CopyLine
                  value={
                    'curl -sSL https://raw.githubusercontent.com/adelpro/open-tilawa/main/deploy-node.sh | bash -s -- --type turn --turn-pass <password>'
                  }
                  label={t('help.copy')}
                />
                <CopyLine
                  value={
                    'ufw allow 3478/udp && ufw allow 3478/tcp && ufw allow 5349/tcp && ufw allow 49160:49200/udp'
                  }
                  label={t('help.copy')}
                />
                <p className="fine-print">{t('turns.deployDns')}</p>
                <a className="fine-print" {...linkProps('/help')}>
                  {t('turns.deployMore')}
                </a>
              </div>
            </details>

        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          title={`${t('turns.editTitle')} — ${editing.name}`}
          submitLabel={t('common.save')}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy === 'edit'}
        >
            <Field label={t('turns.name')}>
              {(id) => (
                <Input
                  id={id}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('turns.host')} hint={t('turns.hostHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editHost}
                  onChange={(event) => setEditHost(event.target.value)}
                />
              )}
            </Field>
            <div className="cluster">
              <Field label={t('turns.transport')}>
                {(id) => (
                  <select
                    id={id}
                    className="field__select"
                    value={editTransport}
                    onChange={(event) => setEditTransport(event.target.value as 'turn' | 'turns')}
                  >
                    <option value="turn">{t('turns.transportPlain')}</option>
                    <option value="turns">{t('turns.transportTls')}</option>
                  </select>
                )}
              </Field>
              <Field label={t('turns.port')}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={editPort}
                    onChange={(event) => setEditPort(event.target.value)}
                  />
                )}
              </Field>
            </div>
        </FormModal>
      ) : null}

      {turns === null ? (
        <SkeletonRows rows={3} label={t('turns.loading')} />
      ) : turns.length === 0 ? (
        <Panel>
          <p className="body muted">{t('turns.empty')}</p>
        </Panel>
      ) : (
        <div className="node-grid">
          {turns.map((turn) => {
            const metrics: NodeMetric[] = [
              {
                label: t('turns.latency'),
                value:
                  turn.latencyMs === null ? (
                    t('turns.latencyUnknown')
                  ) : (
                    <bdi>{`${turn.latencyMs} ms`}</bdi>
                  ),
              },
              {
                // Relative, because "when was it last checked" is a question about
                // freshness; the absolute stamp lives on the server's own screen.
                label: t('turns.lastSeen'),
                value: relative(turn.lastSeen, locale),
              },
            ];
            return (
              <NodeCard
                key={turn.id}
                title={turn.name}
                href={`/turns/${turn.id}`}
                url={turn.url}
                statusTone={statusTone(turn.status)}
                statusLabel={t(statusKey(turn.status))}
                metrics={metrics}
                actions={
                  <>
                    <Button
                      small
                      variant="secondary"
                      icon={<Icon name="refresh" />}
                      onClick={() => void poll(turn.id)}
                      busy={busy === `poll-${turn.id}`}
                    >
                      {t('turns.poll')}
                    </Button>
                    <Button small variant="tertiary" onClick={() => startEdit(turn)}>
                      {t('turns.edit')}
                    </Button>
                    <Button
                      small
                      variant="destructive"
                      onClick={() => setRemoving(turn)}
                      busy={busy === `remove-${turn.id}`}
                    >
                      {t('turns.remove')}
                    </Button>
                  </>
                }
              />
            );
          })}
        </div>
      )}
      {removing ? (
        <ConfirmModal
          title={t('turns.removeTitle')}
          body={t('turns.removeBody')}
          confirmLabel={t('turns.removeConfirm')}
          destructive
          busy={busy === `remove-${removing.id}`}
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            void remove(removing.id);
            setRemoving(null);
          }}
        />
      ) : null}
    </div>
  );
}


/**
 * `turn:host:port` / `turns:host:port` → the three fields the form edits. The
 * API re-validates on save, so a hand-edited URL that does not parse is refused
 * there rather than half-saved here.
 */
function splitTurnUrl(url: string): {
  host: string;
  port: string;
  transport: 'turn' | 'turns';
} {
  const transport: 'turn' | 'turns' = url.startsWith('turns:') ? 'turns' : 'turn';
  const rest = url.replace(/^turns?:/, '').split('?')[0];
  const lastColon = rest.lastIndexOf(':');
  if (lastColon === -1) return { host: rest, port: '3478', transport };
  return {
    host: rest.slice(0, lastColon),
    port: rest.slice(lastColon + 1) || '3478',
    transport,
  };
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
