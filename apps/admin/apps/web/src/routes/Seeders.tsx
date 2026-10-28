import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useSession } from '../lib/session';
import { linkProps, navigate } from '../lib/router';
import { bytes } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { FormModal } from '../components/FormModal';
import { SkeletonRows } from '../components/Skeleton';
import type { Seeder } from '../lib/types-seeders';

function statusTone(status: Seeder['status']): 'ok' | 'bad' | 'notice' {
  return status === 'online' ? 'ok' : status === 'offline' ? 'bad' : 'notice';
}

function statusKey(
  status: Seeder['status'],
): 'seeders.statusOnline' | 'seeders.statusOffline' | 'seeders.statusUnknown' {
  return status === 'online'
    ? 'seeders.statusOnline'
    : status === 'offline'
      ? 'seeders.statusOffline'
      : 'seeders.statusUnknown';
}

/**
 * Seeder nodes. The URL is public (its `/health` is); the admin credentials are
 * stored on the row and used server-side only — the API never returns them, so
 * this screen can only say whether they are set.
 */
export function Seeders(): ReactElement {
  const { user } = useSession();
  const { t, locale } = useI18n();
  const [seeders, setSeeders] = useState<Seeder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');
  // Default on: a node that is registered but empty is the usual mistake, and
  // the push endpoint only adds what the node is missing.
  const [newFill, setNewFill] = useState(true);
  const [editing, setEditing] = useState<Seeder | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editUser, setEditUser] = useState('');
  const [editPass, setEditPass] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setSeeders(await api<Seeder[]>('/seeders'));
    } catch (caught) {
      setSeeders([]);
      setError(caught instanceof Error ? caught.message : t('seeders.loadFailed'));
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
      const created = await api<{ id: number }>('/seeders', {
        method: 'POST',
        body: {
          name: newName.trim(),
          url: newUrl.trim(),
          adminUser: newUser.trim() || undefined,
          adminPass: newPass || undefined,
        },
      });
      setNewName('');
      setNewUrl('');
      setNewUser('');
      setNewPass('');
      setShowAdd(false);
      // Fill at add time: the operator should not have to tick the catalogue
      // checklist for a node they just registered.
      let filled: string | null = null;
      if (newFill) {
        try {
          const result = await api<{
            applied: { seederId: number; added: number; error: string | null }[];
          }>('/reciters/push', { method: 'POST', body: { nodeIds: [created.id] } });
          const row = result.applied.find((entry) => entry.seederId === created.id);
          filled = row?.error
            ? t('seeders.fillFailed', { error: row.error })
            : t('seeders.fillQueued', { count: String(row?.added ?? 0) });
        } catch (caught) {
          filled = t('seeders.fillFailed', {
            error: caught instanceof Error ? caught.message : '',
          });
        }
      }
      setMessage([t('seeders.added'), filled].filter(Boolean).join(' '));
      setNewFill(true);
      await load();
      // Next step is the node's own screen: the catalogue checklist is there,
      // already ticked for everything the new node is missing.
      navigate(`/torrents/${created.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  function startEdit(seeder: Seeder): void {
    setEditing(seeder);
    setEditName(seeder.name);
    setEditUrl(seeder.url);
    setEditUser('');
    setEditPass('');
    setError(null);
  }

  async function saveEdit(): Promise<void> {
    if (!editing) return;
    setBusy('edit');
    setError(null);
    try {
      // Omitted credentials keep what is stored; that is how a name or URL edit
      // never silently wipes a working password.
      const body: Record<string, string> = { name: editName.trim(), url: editUrl.trim() };
      if (editUser.trim()) body.adminUser = editUser.trim();
      if (editPass) body.adminPass = editPass;
      await api(`/seeders/${editing.id}`, { method: 'PATCH', body });
      setEditing(null);
      setMessage(t('seeders.updated'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.updateFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function clearCredentials(id: number): Promise<void> {
    setBusy(`clear-${id}`);
    setError(null);
    try {
      await api(`/seeders/${id}`, { method: 'PATCH', body: { adminUser: null, adminPass: null } });
      setMessage(t('seeders.credentialsCleared'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.updateFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function poll(id: number): Promise<void> {
    setBusy(`poll-${id}`);
    try {
      await api(`/seeders/${id}/poll`, { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function pollAll(): Promise<void> {
    setBusy('poll-all');
    try {
      await api('/seeders/poll-all', { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.pollFailed'));
    } finally {
      setBusy(null);
    }
  }

  if (!user) return <p className="body muted">{t('seeders.signInRequired')}</p>;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('seeders.title')}</h1>
          <p className="body muted">{t('seeders.lede')}</p>
        </div>
        <div className="cluster">
          <Button variant="secondary" onClick={() => void pollAll()} busy={busy === 'poll-all'}>
            {t('seeders.pollAll')}
          </Button>
          <Button onClick={() => setShowAdd(true)}>{t('seeders.add')}</Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {showAdd ? (
        <FormModal
          title={t('seeders.add')}
          submitLabel={t('seeders.addSubmit')}
          onSubmit={() => void add()}
          onClose={() => setShowAdd(false)}
          busy={busy === 'add'}
          disabled={!newName.trim() || !newUrl.trim()}
        >
            <Field label={t('seeders.name')}>
              {(id) => (
                <Input
                  id={id}
                  value={newName}
                  onChange={(event) => setNewName(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('seeders.url')} hint={t('seeders.urlHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newUrl}
                  onChange={(event) => setNewUrl(event.target.value)}
                  placeholder="http://192.168.1.100:8085"
                />
              )}
            </Field>
            <Field label={t('seeders.adminUser')} hint={t('torrents.credentialsHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={newUser}
                  onChange={(event) => setNewUser(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('seeders.adminPass')}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={newPass}
                  onChange={(event) => setNewPass(event.target.value)}
                />
              )}
            </Field>
            <div className="stack">
              <label className="cluster">
                <input
                  type="checkbox"
                  checked={newFill}
                  onChange={(event) => setNewFill(event.target.checked)}
                />
                <span>{t('seeders.fillOnAdd')}</span>
              </label>
              <p className="fine-print">{t('seeders.fillOnAddHint')}</p>
            </div>
        </FormModal>
      ) : null}

      {editing ? (
        <FormModal
          title={`${t('seeders.editTitle')} — ${editing.name}`}
          submitLabel={t('common.save')}
          onSubmit={() => void saveEdit()}
          onClose={() => setEditing(null)}
          busy={busy === 'edit'}
          extra={
            editing.hasCredentials ? (
              <Button variant="destructive" onClick={() => void clearCredentials(editing.id)}>
                {t('seeders.clearCredentials')}
              </Button>
            ) : null
          }
        >
            <Field label={t('seeders.name')}>
              {(id) => (
                <Input
                  id={id}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('seeders.url')} hint={t('seeders.urlHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editUrl}
                  onChange={(event) => setEditUrl(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('seeders.adminUser')} hint={t('seeders.credentialsKeepHint')}>
              {(id) => (
                <Input
                  id={id}
                  value={editUser}
                  onChange={(event) => setEditUser(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('seeders.adminPass')}>
              {(id) => (
                <Input
                  id={id}
                  type="password"
                  value={editPass}
                  onChange={(event) => setEditPass(event.target.value)}
                />
              )}
            </Field>
        </FormModal>
      ) : null}

      {seeders === null ? (
        <SkeletonRows rows={3} label={t('seeders.loading')} />
      ) : seeders.length === 0 ? (
        <Panel>
          <p className="body muted">{t('seeders.empty')}</p>
        </Panel>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table className="table table--seeders">
              <thead>
                <tr>
                  <th scope="col">{t('seeders.server')}</th>
                  <th scope="col">{t('seeders.traffic')}</th>
                  <th scope="col">{t('seeders.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {seeders.map((seeder) => (
                  <tr
                    key={seeder.id}
                    className="table__row--clickable"
                    onClick={() => navigate(`/torrents/${seeder.id}`)}
                  >
                    <td>
                      <span className="row__cell">
                        <span className="row__line">
                          <a className="row__label" {...linkProps(`/torrents/${seeder.id}`)}>
                            {seeder.name}
                          </a>
                          <Chip tone={statusTone(seeder.status)}>
                            {t(statusKey(seeder.status))}
                          </Chip>
                          {/* Credentials never reach this screen — the API does not
                              return them. The row can only say whether any are set. */}
                          <span className="row__meta">
                            ·{' '}
                            {t(
                              seeder.hasCredentials
                                ? 'seeders.credentialsSet'
                                : 'seeders.credentialsMissing',
                            )}
                          </span>
                        </span>
                        <span className="row__line">
                          <Chip tone={seeder.version ? 'ok' : 'notice'}>
                            {seeder.version
                              ? `v${seeder.version}`
                              : t('seeders.versionUnknown')}
                          </Chip>
                          <span className="row__id" title={seeder.url}>
                            {seeder.url}
                          </span>
                        </span>
                      </span>
                    </td>
                    <td>
                      {t('seeders.torrentCount', { count: String(seeder.torrentCount) })} ·{' '}
                      {t('seeders.peerCount', { count: String(seeder.peerCount) })}
                      <br />
                      <span className="row__meta">
                        ↑ {bytes(seeder.uploadSpeed, locale, true)} · ↓{' '}
                        {bytes(seeder.downloadSpeed, locale, true)}
                      </span>
                      <br />
                      <span className="row__meta">
                        {t('seeders.diskFree', {
                          free: bytes(seeder.freeBytes, locale),
                          total: bytes(seeder.totalBytes, locale),
                        })}
                      </span>
                      <br />
                      <span className="row__meta">
                        {seeder.quotaBytes
                          ? t('seeders.quota', {
                              used: bytes(seeder.usedBytes, locale),
                              quota: bytes(seeder.quotaBytes, locale),
                            })
                          : t('seeders.quotaUnlimited')}
                        {' · '}
                        {t('seeders.headroom', {
                          headroom: bytes(seeder.headroomBytes, locale),
                        })}
                      </span>
                    </td>
                    <td>
                      <span className="row__actions">
                        <Button
                          small
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            void poll(seeder.id);
                          }}
                          busy={busy === `poll-${seeder.id}`}
                        >
                          {t('seeders.probe')}
                        </Button>
                        <Button
                          small
                          variant="secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/torrents/${seeder.id}`);
                          }}
                        >
                          {t('seeders.manage')}
                        </Button>
                        <Button
                          small
                          variant="tertiary"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEdit(seeder);
                          }}
                        >
                          {t('seeders.edit')}
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
