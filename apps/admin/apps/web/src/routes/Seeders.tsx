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
import type { Seeder } from '../lib/types-seeders';

/**
 * Seeder nodes. The URL is public (its `/health` is); the admin credentials are
 * stored on the row and used server-side only — the API never returns them, so
 * this screen can only say whether they are set.
 */
export function Seeders(): ReactElement {
  const { user } = useSession();
  const { t } = useI18n();
  const [seeders, setSeeders] = useState<Seeder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newPass, setNewPass] = useState('');

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
      await api('/seeders', {
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
      setMessage(t('seeders.added'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.addFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: number): Promise<void> {
    setBusy(`remove-${id}`);
    try {
      await api(`/seeders/${id}`, { method: 'DELETE' });
      setMessage(t('seeders.removed'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('seeders.removeFailed'));
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
          <Button onClick={() => setShowAdd(!showAdd)}>
            {showAdd ? t('seeders.cancel') : t('seeders.add')}
          </Button>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      {showAdd ? (
        <Panel>
          <div className="stack">
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
            <Field label={t('seeders.adminUser')} hint={t('seeders.credentialsHint')}>
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
            <div className="cluster">
              <Button
                onClick={() => void add()}
                busy={busy === 'add'}
                disabled={!newName.trim() || !newUrl.trim()}
              >
                {t('seeders.addSubmit')}
              </Button>
            </div>
          </div>
        </Panel>
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
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">{t('seeders.name')}</th>
                  <th scope="col">{t('seeders.statusHeading')}</th>
                  <th scope="col">{t('seeders.traffic')}</th>
                  <th scope="col">{t('seeders.credentials')}</th>
                  <th scope="col">{t('seeders.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {seeders.map((seeder) => (
                  <tr key={seeder.id}>
                    <td>
                      <span className="row__label">{seeder.name}</span>
                      <br />
                      <span className="row__id">{seeder.url}</span>
                    </td>
                    <td>
                      <Chip
                        tone={
                          seeder.status === 'online'
                            ? 'ok'
                            : seeder.status === 'offline'
                              ? 'bad'
                              : 'notice'
                        }
                      >
                        {t(
                          seeder.status === 'online'
                            ? 'seeders.statusOnline'
                            : seeder.status === 'offline'
                              ? 'seeders.statusOffline'
                              : 'seeders.statusUnknown',
                        )}
                      </Chip>
                    </td>
                    <td>
                      {t('seeders.torrentCount', { count: String(seeder.torrentCount) })} ·{' '}
                      {t('seeders.peerCount', { count: String(seeder.peerCount) })}
                      <br />
                      <span className="row__meta">
                        ↑ {seeder.uploadSpeed} · ↓ {seeder.downloadSpeed}
                      </span>
                    </td>
                    <td>
                      {seeder.hasCredentials
                        ? t('seeders.credentialsSet')
                        : t('seeders.credentialsMissing')}
                    </td>
                    <td>
                      <span className="cluster cluster--end">
                        <Button
                          small
                          variant="secondary"
                          onClick={() => void poll(seeder.id)}
                          busy={busy === `poll-${seeder.id}`}
                        >
                          {t('seeders.probe')}
                        </Button>
                        <Button
                          small
                          variant="destructive"
                          onClick={() => void remove(seeder.id)}
                          busy={busy === `remove-${seeder.id}`}
                        >
                          {t('seeders.remove')}
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
