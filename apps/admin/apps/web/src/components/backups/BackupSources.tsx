import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { api } from '../../lib/api';
import { relative } from '../../lib/format';
import { useI18n } from '../../lib/i18n';
import { useSession } from '../../lib/session';
import { sourceHealth } from '../../lib/backup-sources';
import { Button } from '../Button';
import { Chip, Notice } from '../Chip';
import { ConfirmModal } from '../ConfirmModal';
import { Field, Input, TextArea } from '../Field';
import { FormModal } from '../FormModal';
import { Panel } from '../Panel';
import { SnapshotFilterBar, type SnapshotFilterState } from './SnapshotFilterBar';
import { filterSnapshots, sortSnapshots } from '../../lib/snapshot-filters';

type Target = {
  id: string;
  label: string;
  host: string;
  port: number;
  username: string;
  remoteDir: string;
  enabled: boolean;
  lastState: string | null;
  lastCheckedAt: string | null;
  lastError: string | null;
};

type Snapshot = { name: string; size: number; mtime: string };

const EMPTY_FORM = {
  label: '',
  host: '',
  port: '22',
  username: '',
  remoteDir: '',
  enabled: true,
};

const HEALTH_KEY = {
  never: 'backups.healthNever',
  ok: 'backups.healthOk',
  failed: 'backups.healthFailed',
  stale: 'backups.healthStale',
} as const;

const HEALTH_TONE = { never: 'notice', ok: 'ok', failed: 'bad', stale: 'notice' } as const;

/**
 * SFTP destinations, managed from the Backups screen.
 *
 * The console stores metadata; the credential is written once to the bridge and never
 * read back. Everything destructive is owner-only, and the file list is read-only.
 */
export function BackupSources(): ReactElement {
  const { t, locale } = useI18n();
  const { user } = useSession();
  const [targets, setTargets] = useState<Target[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Target | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [credentialFor, setCredentialFor] = useState<Target | null>(null);
  const [credential, setCredential] = useState({ password: '', privateKey: '' });
  const [removing, setRemoving] = useState<Target | null>(null);
  const [filesFor, setFilesFor] = useState<Target | null>(null);
  const [files, setFiles] = useState<Snapshot[]>([]);
  const [filters, setFilters] = useState<SnapshotFilterState>({
    query: '',
    sort: 'newest',
    olderThanDays: null,
  });
  const visibleFiles = useMemo(
    () =>
      sortSnapshots(
        filterSnapshots(files, {
          query: filters.query,
          olderThanDays: filters.olderThanDays,
        }),
        filters.sort,
      ),
    [files, filters],
  );

  const load = useCallback(async () => {
    try {
      setTargets(await api<Target[]>('/backup-targets'));
    } catch {
      setError(t('backups.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEditor(target: Target | 'new'): void {
    setError(null);
    setEditing(target);
    setForm(
      target === 'new'
        ? EMPTY_FORM
        : {
            label: target.label,
            host: target.host,
            port: String(target.port),
            username: target.username,
            remoteDir: target.remoteDir,
            enabled: target.enabled,
          },
    );
  }

  async function save(): Promise<void> {
    setBusy('save');
    setError(null);
    try {
      const body = {
        label: form.label.trim(),
        host: form.host.trim(),
        port: Number(form.port),
        username: form.username.trim(),
        remoteDir: form.remoteDir.trim(),
        enabled: form.enabled,
      };
      if (editing === 'new') {
        await api('/backup-targets', { method: 'POST', body });
      } else if (editing) {
        await api(`/backup-targets/${editing.id}`, { method: 'PUT', body });
      }
      setEditing(null);
      setNotice(t('backups.saved'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function check(target: Target): Promise<void> {
    setBusy(`check-${target.id}`);
    setError(null);
    try {
      await api(`/backup-targets/${target.id}/check`, { method: 'POST' });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function saveCredential(): Promise<void> {
    if (!credentialFor) return;
    setBusy('credential');
    setError(null);
    try {
      await api(`/backup-targets/${credentialFor.id}/credentials`, {
        method: 'PUT',
        body: {
          password: credential.password || undefined,
          privateKey: credential.privateKey || undefined,
        },
      });
      setCredentialFor(null);
      setCredential({ password: '', privateKey: '' });
      setNotice(t('backups.credentialSaved'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function remove(): Promise<void> {
    if (!removing) return;
    setBusy('remove');
    setError(null);
    try {
      await api(`/backup-targets/${removing.id}`, { method: 'DELETE' });
      setRemoving(null);
      if (filesFor?.id === removing.id) setFilesFor(null);
      setNotice(t('backups.removed'));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function showFiles(target: Target): Promise<void> {
    setBusy(`files-${target.id}`);
    setError(null);
    try {
      setFiles(await api<Snapshot[]>(`/backup-targets/${target.id}/files`));
      setFilesFor(target);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('backups.actionFailed'));
    } finally {
      setBusy(null);
    }
  }

  const owner = user?.isOwner === true;

  return (
    <Panel>
      <div className="panel-head">
        <div>
          <h2 className="display-sm">{t('backups.sources')}</h2>
          <p className="muted">{t('backups.sourcesHint')}</p>
        </div>
        <Button small onClick={() => openEditor('new')}>
          {t('backups.addSource')}
        </Button>
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {notice ? <Notice tone="ok">{notice}</Notice> : null}

      {targets.length === 0 ? (
        <p className="body muted">{t('backups.sourcesEmpty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t('backups.label')}</th>
                <th scope="col">{t('backups.host')}</th>
                <th scope="col">{t('backups.healthNever')}</th>
                <th scope="col" aria-label={t('backups.snapshots')} />
              </tr>
            </thead>
            <tbody>
              {targets.map((target) => {
                const health = sourceHealth(target);
                return (
                  <tr key={target.id}>
                    <td>{target.label}</td>
                    <td className="mono">
                      {target.host}:{target.port} · {target.remoteDir}
                    </td>
                    <td>
                      <Chip tone={HEALTH_TONE[health.key]}>
                        {health.at
                          ? t('backups.healthAt', {
                              state: t(HEALTH_KEY[health.key]),
                              when: relative(health.at, locale),
                            })
                          : t(HEALTH_KEY[health.key])}
                      </Chip>
                    </td>
                    <td>
                      <span className="cluster">
                        <Button
                          small
                          variant="secondary"
                          busy={busy === `check-${target.id}`}
                          onClick={() => void check(target)}
                        >
                          {t('backups.check')}
                        </Button>
                        <Button
                          small
                          variant="tertiary"
                          busy={busy === `files-${target.id}`}
                          onClick={() => void showFiles(target)}
                        >
                          {t('backups.snapshots')}
                        </Button>
                        <Button small variant="tertiary" onClick={() => openEditor(target)}>
                          {t('backups.editSource')}
                        </Button>
                        {owner ? (
                          <>
                            <Button
                              small
                              variant="tertiary"
                              onClick={() => {
                                setCredential({ password: '', privateKey: '' });
                                setCredentialFor(target);
                              }}
                            >
                              {t('backups.credential')}
                            </Button>
                            <Button small variant="tertiary" onClick={() => setRemoving(target)}>
                              {t('backups.removeSource')}
                            </Button>
                          </>
                        ) : null}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filesFor ? (
        <div className="stack stack--tight">
          <h3 className="h3">
            {t('backups.snapshots')} · {filesFor.label}
          </h3>
          {files.length === 0 ? (
            <p className="body muted">{t('backups.filesEmpty')}</p>
          ) : (
            <>
              <SnapshotFilterBar value={filters} onChange={setFilters} />
              {visibleFiles.length === 0 ? (
                <p className="body muted">{t('backups.noMatch')}</p>
              ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{t('backups.file')}</th>
                    <th scope="col">{t('backups.size')}</th>
                    <th scope="col">{t('backups.when')}</th>
                    <th scope="col" aria-label={t('backups.download')} />
                  </tr>
                </thead>
                <tbody>
                  {visibleFiles.map((file) => (
                    <tr key={file.name}>
                      <td className="mono">{file.name}</td>
                      <td>{file.size}</td>
                      <td>{relative(file.mtime, locale)}</td>
                      <td>
                        <a
                          className="btn btn--secondary btn--sm"
                          href={`/api/backup-targets/${filesFor.id}/files/${encodeURIComponent(file.name)}/download`}
                        >
                          {t('backups.download')}
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              )}
            </>
          )}
        </div>
      ) : (
        <p className="body muted">{t('backups.chooseSource')}</p>
      )}

      {editing ? (
        <FormModal
          title={editing === 'new' ? t('backups.addSource') : t('backups.editSource')}
          submitLabel={t('backups.saveSource')}
          onSubmit={() => void save()}
          onClose={() => setEditing(null)}
          busy={busy === 'save'}
        >
          <Field label={t('backups.label')}>
            {(id) => (
              <Input
                id={id}
                value={form.label}
                onChange={(event) => setForm({ ...form, label: event.target.value })}
              />
            )}
          </Field>
          <Field label={t('backups.host')}>
            {(id) => (
              <Input
                id={id}
                value={form.host}
                onChange={(event) => setForm({ ...form, host: event.target.value })}
              />
            )}
          </Field>
          <div className="field-row">
            <Field label={t('backups.port')}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  value={form.port}
                  onChange={(event) => setForm({ ...form, port: event.target.value })}
                />
              )}
            </Field>
            <Field label={t('backups.username')}>
              {(id) => (
                <Input
                  id={id}
                  value={form.username}
                  onChange={(event) => setForm({ ...form, username: event.target.value })}
                />
              )}
            </Field>
          </div>
          <Field label={t('backups.remoteDir')}>
            {(id) => (
              <Input
                id={id}
                value={form.remoteDir}
                onChange={(event) => setForm({ ...form, remoteDir: event.target.value })}
              />
            )}
          </Field>
        </FormModal>
      ) : null}

      {credentialFor ? (
        <FormModal
          title={`${t('backups.credential')} · ${credentialFor.label}`}
          submitLabel={t('backups.saveCredential')}
          onSubmit={() => void saveCredential()}
          onClose={() => setCredentialFor(null)}
          busy={busy === 'credential'}
        >
          <p className="muted">{t('backups.credentialHint')}</p>
          <Field label={t('backups.password')}>
            {(id) => (
              <Input
                id={id}
                type="password"
                autoComplete="new-password"
                value={credential.password}
                onChange={(event) => setCredential({ ...credential, password: event.target.value })}
              />
            )}
          </Field>
          <Field label={t('backups.privateKey')}>
            {(id) => (
              <TextArea
                id={id}
                rows={5}
                value={credential.privateKey}
                onChange={(event) =>
                  setCredential({ ...credential, privateKey: event.target.value })
                }
              />
            )}
          </Field>
        </FormModal>
      ) : null}

      {removing ? (
        <ConfirmModal
          title={t('backups.removeTitle')}
          body={t('backups.removeBody')}
          confirmLabel={t('backups.removeSource')}
          destructive
          busy={busy === 'remove'}
          onConfirm={() => void remove()}
          onClose={() => setRemoving(null)}
        >
          <p className="body muted">{removing.label}</p>
        </ConfirmModal>
      ) : null}
    </Panel>
  );
}
