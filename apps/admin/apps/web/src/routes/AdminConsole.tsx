import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { relative } from '../lib/format';
import { useI18n } from '../lib/i18n';
import { useSession } from '../lib/session';
import type { AdminUser, AuditEntry } from '../lib/types';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { SearchField } from '../components/fields';
import { Chip, Notice } from '../components/Chip';
import { Modal } from '../components/Modal';
import { Panel } from '../components/Panel';
import { SkeletonRows } from '../components/Skeleton';
import { Tabs } from '../components/Tabs';

type Tab = 'users' | 'audit';

/** The reader's word for each role and status; the raw value stays the chip's title. */
const ROLE_KEY = {
  user: 'admin.roleUser',
  admin: 'admin.roleAdmin',
  super_admin: 'admin.roleSuper',
} as const;

const STATUS_KEY = {
  active: 'admin.statusActive',
  disabled: 'admin.statusDisabled',
} as const;

/**
 * The admin console, in two sizes.
 *
 * An admin gets the support verbs: search, disable and enable, plus read-only
 * health and audit. A super admin gets the same screen with the irreversible verbs —
 * role changes and deletion — on the same rows. One component keeps the two consoles
 * from becoming two systems; `isSuper` decides which controls exist, never the API.
 *
 * Role and status render as words in the reader's language, because this is a screen
 * an operator looks at, not a CLI. The API name is not lost: it is the chip's title,
 * it is what the role-change dialog quotes back, and it is what the filter sends.
 */
export function AdminConsole({ isSuper }: { isSuper: boolean }): ReactElement {
  const { t, locale } = useI18n();
  const { user: currentUser } = useSession();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'user' | 'admin' | 'super_admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingRole, setPendingRole] = useState<{
    entry: AdminUser;
    role: 'admin' | 'user';
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AdminUser | null>(null);
  const [typed, setTyped] = useState('');

  const load = useCallback(async () => {
    setError(null);
    try {
      setUsers(
        await api<AdminUser[]>(`/admin/users${query ? `?q=${encodeURIComponent(query)}` : ''}`),
      );
    } catch (caught) {
      setUsers([]);
      setError(caught instanceof Error ? caught.message : t('admin.loadFailed'));
    }
  }, [query, t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      try {
        setAudit(await api<AuditEntry[]>('/admin/audit?limit=50'));
      } catch {
        setAudit([]);
      }
    })();
  }, []);

  const act = async (
    key: string,
    path: string,
    method: string,
    body?: unknown,
  ): Promise<boolean> => {
    setError(null);
    setMessage(null);
    setBusy(key);
    try {
      await api(path, { method, body });
      setMessage(t('admin.saved'));
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('admin.refused'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggleStatus = (entry: AdminUser): Promise<boolean> =>
    act(
      `status-${entry.id}`,
      `/admin/users/${entry.id}/${entry.status === 'active' ? 'disable' : 'enable'}`,
      'POST',
    );

  const applyRole = async (): Promise<void> => {
    if (!pendingRole) return;
    const ok = await act(
      `role-${pendingRole.entry.id}`,
      `/admin/users/${pendingRole.entry.id}/role`,
      'POST',
      {
        role: pendingRole.role,
      },
    );
    if (ok) setPendingRole(null);
  };

  const destroy = async (): Promise<void> => {
    if (!pendingDelete || typed !== pendingDelete.email) return;
    const ok = await act(
      `delete-${pendingDelete.id}`,
      `/admin/users/${pendingDelete.id}`,
      'DELETE',
    );
    if (ok) {
      setPendingDelete(null);
      setTyped('');
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'users', label: t('admin.tab.users') },
    { id: 'audit', label: t('admin.tab.audit') },
  ];

  const visibleUsers = users
    ? users.filter(
        (u) =>
          (roleFilter === 'all' || u.role === roleFilter) &&
          (statusFilter === 'all' || u.status === statusFilter),
      )
    : null;

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <div className="cluster">
            <h1 className="display-lg">{isSuper ? t('super.title') : t('admin.title')}</h1>
            <Chip tone={isSuper ? 'notice' : 'info'}>
              <span title={isSuper ? 'super_admin' : 'admin'}>
                {t(isSuper ? 'admin.roleSuper' : 'admin.roleAdmin')}
              </span>
            </Chip>
            {currentUser?.isOwner ? <Chip tone="ok">{t('admin.owner')}</Chip> : null}
          </div>
          <p className="body muted">{isSuper ? t('super.lede') : t('admin.lede')}</p>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      <Tabs items={tabs} active={tab} onChange={setTab} label={t('admin.tabs')} />

      <div id={`panel-${tab}`} className="stack" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'users' ? (
          <Panel>
            <div className="toolbar">
              <SearchField
                label={t('admin.search')}
                value={query}
                onChange={setQuery}
                placeholder={t('admin.searchPlaceholder')}
              />
              <label className="field" style={{ minWidth: '8rem' }}>
                <span className="label">{t('admin.role')}</span>
                <select
                  className="field__select"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                >
                  <option value="all">{t('admin.all')}</option>
                  <option value="user">{t('admin.roleUser')}</option>
                  <option value="admin">{t('admin.roleAdmin')}</option>
                  <option value="super_admin">{t('admin.roleSuper')}</option>
                </select>
              </label>
              <label className="field" style={{ minWidth: '8rem' }}>
                <span className="label">{t('common.status')}</span>
                <select
                  className="field__select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                >
                  <option value="all">{t('admin.all')}</option>
                  <option value="active">{t('admin.statusActive')}</option>
                  <option value="disabled">{t('admin.statusDisabled')}</option>
                </select>
              </label>
              <Button variant="secondary" onClick={() => void load()}>
                {t('admin.refresh')}
              </Button>
              {visibleUsers ? (
                <span className="fine-print">
                  {t('admin.count', { count: visibleUsers.length })}
                </span>
              ) : null}
            </div>

            {users === null ? (
              <SkeletonRows rows={4} label={t('admin.title')} />
            ) : (visibleUsers?.length ?? 0) === 0 ? (
              <p className="body muted">{t('admin.noUsers')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table table--wide">
                  <thead>
                    <tr>
                      <th>{t('common.name')}</th>
                      <th>{t('common.email')}</th>
                      <th>{t('admin.role')}</th>
                      <th>{t('common.status')}</th>
                      <th aria-label={t('admin.actions')} />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers?.map((entry) => {
                      const self = entry.id === currentUser?.id;
                      const iAmOwner = currentUser?.isOwner === true;
                      // A non-owner super_admin cannot touch another super_admin,
                      // and nobody can touch the Owner row.
                      const protectedEntry =
                        entry.isOwner || (!iAmOwner && entry.role === 'super_admin');
                      const canModerate = iAmOwner || entry.role === 'user';
                      return (
                        <tr key={entry.id}>
                          <td data-label={t('common.name')}>
                            {entry.name}
                            {self ? <span className="fine-print"> · {t('admin.you')}</span> : null}
                          </td>
                          <td className="muted" data-label={t('common.email')}>
                            {entry.email}
                          </td>
                          <td data-label={t('admin.role')}>
                            <Chip tone={entry.role === 'user' ? 'info' : 'notice'}>
                              <span title={entry.role}>{t(ROLE_KEY[entry.role])}</span>
                            </Chip>
                            {entry.isOwner ? <Chip tone="ok">{t('admin.owner')}</Chip> : null}
                          </td>
                          <td data-label={t('common.status')}>
                            <Chip tone={entry.status === 'active' ? 'ok' : 'bad'}>
                              <span title={entry.status}>{t(STATUS_KEY[entry.status])}</span>
                            </Chip>
                          </td>
                          <td className="num" data-label={t('admin.actions')}>
                            <span className="cluster cluster--end">
                              {iAmOwner && !protectedEntry && entry.role !== 'super_admin' ? (
                                <Button
                                  variant="tertiary"
                                  small
                                  onClick={() => {
                                    setError(null);
                                    setPendingRole({
                                      entry,
                                      role: entry.role === 'user' ? 'admin' : 'user',
                                    });
                                  }}
                                >
                                  {entry.role === 'user'
                                    ? t('super.makeAdmin')
                                    : t('super.makeUser')}
                                </Button>
                              ) : null}
                              {!self && !protectedEntry && canModerate ? (
                                <Button
                                  variant={entry.status === 'active' ? 'destructive' : 'secondary'}
                                  small
                                  busy={busy === `status-${entry.id}`}
                                  onClick={() => void toggleStatus(entry)}
                                >
                                  {entry.status === 'active'
                                    ? t('admin.disable')
                                    : t('admin.enable')}
                                </Button>
                              ) : null}
                              {iAmOwner && !self && !protectedEntry ? (
                                <Button
                                  variant="tertiary"
                                  small
                                  onClick={() => {
                                    setError(null);
                                    setPendingDelete(entry);
                                    setTyped('');
                                  }}
                                >
                                  {t('common.delete')}
                                </Button>
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
          </Panel>
        ) : null}

        {tab === 'audit' ? (
          <Panel tone="parchment">
            <div className="panel-head">
              <h2 className="display-sm">{t('admin.recent')}</h2>
            </div>
            {audit === null ? (
              <SkeletonRows rows={4} label={t('admin.recent')} />
            ) : audit.length === 0 ? (
              <p className="body muted">{t('admin.nothing')}</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('usage.action')}</th>
                      <th>{t('usage.target')}</th>
                      <th>{t('usage.when')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.map((entry) => (
                      <tr key={entry.id}>
                        <td>
                          <code>{entry.action}</code>
                        </td>
                        <td className="truncate">{entry.target ?? '—'}</td>
                        <td className="muted">{relative(entry.created_at, locale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        ) : null}
      </div>

      {pendingRole ? (
        <Modal
          title={t('admin.roleTitle', { email: pendingRole.entry.email })}
          onClose={() => setPendingRole(null)}
        >
          <div className="stack">
            <p className="body">
              {t('admin.roleConfirm', {
                email: pendingRole.entry.email,
                role: pendingRole.role,
              })}
            </p>
            {error ? <Notice tone="bad">{error}</Notice> : null}
            <div className="cluster cluster--end">
              <Button variant="secondary" onClick={() => setPendingRole(null)}>
                {t('common.cancel')}
              </Button>
              <Button
                busy={busy === `role-${pendingRole.entry.id}`}
                onClick={() => void applyRole()}
              >
                {pendingRole.role === 'admin' ? t('super.makeAdmin') : t('super.makeUser')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {pendingDelete ? (
        <Modal
          title={t('super.deleteTitle', { email: pendingDelete.email })}
          onClose={() => setPendingDelete(null)}
        >
          <div className="stack">
            <p className="body">{t('super.deleteBody')}</p>
            {error ? <Notice tone="bad">{error}</Notice> : null}
            <Field label={t('super.deleteConfirmLabel', { email: pendingDelete.email })}>
              {(id) => (
                <Input
                  id={id}
                  name="confirm-email"
                  autoComplete="off"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                />
              )}
            </Field>
            <div className="cluster cluster--end">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingDelete(null);
                  setTyped('');
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                disabled={typed !== pendingDelete.email}
                busy={busy === `delete-${pendingDelete.id}`}
                onClick={() => void destroy()}
              >
                {t('super.deleteAction')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
