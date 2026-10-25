import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { relative, shortDate } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';
import type { ApiKey } from '../lib/types';
import { Button } from '../components/Button';
import { AsyncButton } from '../components/AsyncButton';
import { Icon } from '../components/icons';
import { Field, Input } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { Modal } from '../components/Modal';
import { SkeletonRows } from '../components/Skeleton';

const SCOPES = ['profile:read', 'profile:write', 'gate:run'] as const;

/** A status the API reports, and the word a person reads for it. */
const STATUS_KEYS: Record<string, MessageKey> = {
  active: 'keys.status.active',
  expired: 'keys.status.expired',
  revoked: 'keys.status.revoked',
};

/**
 * API keys (T6.3).
 *
 * The one moment that must not be softened: a new key is shown once, in the cream
 * panel, with the sentence that says so. There is no toast, no auto-dismiss, and
 * closing is an explicit act.
 */
export function Keys(): ReactElement {
  const { t, locale } = useI18n();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState<string[]>(['profile:read']);
  const [revealed, setRevealed] = useState<{ key: string; label: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  // Inline rename: one key at a time, so two open editors cannot fight over the row.
  const [renaming, setRenaming] = useState<{ id: number; label: string; draft: string } | null>(
    null,
  );
  const [renameBusy, setRenameBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setKeys(await api<ApiKey[]>('/api-keys'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('keys.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const mint = async (): Promise<void> => {
    setError(null);
    try {
      const created = await api<{ key: string; record: ApiKey }>('/api-keys', {
        method: 'POST',
        body: { label, scopes },
      });
      setRevealed({ key: created.key, label: created.record.label });
      setAcknowledged(false);
      setMinting(false);
      setLabel('');
      setScopes(['profile:read']);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('keys.mintFailed'));
    }
  };

  const revoke = async (key: ApiKey): Promise<void> => {
    if (!window.confirm(t('keys.revokeConfirm', { label: key.label }))) return;
    await api(`/api-keys/${key.id}`, { method: 'DELETE' });
    await load();
  };

  const rotate = async (key: ApiKey): Promise<void> => {
    if (!window.confirm(t('keys.rotateConfirm', { label: key.label }))) return;
    const rotated = await api<{ key: string; record: ApiKey; replaced: string }>(
      `/api-keys/${key.id}/rotate`,
      { method: 'POST' },
    );
    setRevealed({ key: rotated.key, label: rotated.record.label });
    setAcknowledged(false);
    await load();
  };

  const saveRename = async (): Promise<void> => {
    if (!renaming) return;
    const next = renaming.draft.trim();
    if (!next || next === renaming.label) {
      setRenaming(null);
      return;
    }
    setRenameBusy(true);
    setError(null);
    try {
      const updated = await api<ApiKey>(`/api-keys/${renaming.id}`, {
        method: 'PATCH',
        body: { label: next },
      });
      setKeys((current) =>
        current ? current.map((key) => (key.id === updated.id ? updated : key)) : current,
      );
      setRenaming(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('keys.renameFailed'));
    } finally {
      setRenameBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="display-lg">{t('keys.title')}</h1>
          <p className="body muted">{t('keys.lede')}</p>
        </div>
        <Button icon={<Icon name="plus" />} onClick={() => setMinting(true)}>
          {t('keys.new')}
        </Button>
      </div>

      {error ? <Notice tone="bad">{error}</Notice> : null}

      {keys === null ? (
        <SkeletonRows rows={3} label={t('keys.title')} />
      ) : keys.length === 0 ? (
        <Panel tone="parchment">
          <div className="empty">{t('keys.empty')}</div>
        </Panel>
      ) : (
        <Panel>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('keys.label')}</th>
                  <th>{t('keys.key')}</th>
                  <th>{t('keys.scopes')}</th>
                  <th>{t('keys.lastUsed')}</th>
                  <th>{t('keys.status')}</th>
                  <th aria-label={t('account.devices.actions')} />
                </tr>
              </thead>
              <tbody>
                {keys.map((key) => (
                  <tr key={key.id}>
                    <td>
                      {renaming?.id === key.id ? (
                        <span className="cluster" style={{ gap: 'var(--space-2)' }}>
                          <Input
                            id={`rename-${key.id}`}
                            name="key-label"
                            autoComplete="off"
                            value={renaming.draft}
                            autoFocus
                            maxLength={64}
                            onChange={(event) =>
                              setRenaming({ ...renaming, draft: event.target.value })
                            }
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') void saveRename();
                              if (event.key === 'Escape') setRenaming(null);
                            }}
                          />
                          <Button
                            variant="secondary"
                            small
                            onClick={() => void saveRename()}
                            disabled={renameBusy || renaming.draft.trim() === ''}
                          >
                            {t('common.save')}
                          </Button>
                          <Button variant="tertiary" small onClick={() => setRenaming(null)}>
                            {t('common.cancel')}
                          </Button>
                        </span>
                      ) : (
                        <span className="cluster" style={{ gap: 'var(--space-2)' }}>
                          <span>{key.label}</span>
                          <Button
                            variant="tertiary"
                            small
                            icon={<Icon name="edit" />}
                            aria-label={t('keys.rename')}
                            title={t('keys.rename')}
                            onClick={() =>
                              setRenaming({ id: key.id, label: key.label, draft: key.label })
                            }
                          >
                            {t('keys.rename')}
                          </Button>
                        </span>
                      )}
                    </td>
                    <td>
                      <code>{key.prefix}…</code>
                    </td>
                    <td className="muted">{key.scopes.join(', ')}</td>
                    <td className="muted">{relative(key.lastUsedAt, locale)}</td>
                    <td>
                      <Chip
                        tone={
                          key.status === 'active'
                            ? 'ok'
                            : key.status === 'expired'
                              ? 'notice'
                              : 'bad'
                        }
                      >
                        {STATUS_KEYS[key.status] ? t(STATUS_KEYS[key.status]) : key.status}
                      </Chip>
                    </td>
                    <td className="num">
                      {key.status === 'active' ? (
                        <span className="cluster" style={{ justifyContent: 'flex-end' }}>
                          <AsyncButton
                            variant="tertiary"
                            small
                            icon={<Icon name="key" />}
                            onClick={() => rotate(key)}
                          >
                            {t('keys.rotate')}
                          </AsyncButton>
                          <AsyncButton
                            variant="destructive"
                            small
                            icon={<Icon name="trash" />}
                            onClick={() => revoke(key)}
                          >
                            {t('keys.revoke')}
                          </AsyncButton>
                        </span>
                      ) : (
                        <span className="fine-print">
                          {t('keys.revokedAt', { date: shortDate(key.revokedAt, locale) })}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {minting ? (
        <Modal title={t('keys.modalNew')} onClose={() => setMinting(false)}>
          <div className="stack">
            <Field label={t('keys.label')} hint={t('keys.labelHint')}>
              {(id) => (
                <Input
                  id={id}
                  name="label"
                  autoComplete="off"
                  value={label}
                  onChange={(event) => setLabel(event.target.value)}
                />
              )}
            </Field>
            <fieldset className="stack stack--tight" style={{ border: 0, padding: 0 }}>
              <legend className="field__label">{t('keys.scopes')}</legend>
              {SCOPES.map((scope) => (
                <label key={scope} className="cluster" style={{ gap: 'var(--space-2)' }}>
                  <input
                    type="checkbox"
                    checked={scopes.includes(scope)}
                    onChange={(event) =>
                      setScopes((current) =>
                        event.target.checked
                          ? [...current, scope]
                          : current.filter((entry) => entry !== scope),
                      )
                    }
                  />
                  <span className="code">{scope}</span>
                </label>
              ))}
            </fieldset>
            <div className="cluster">
              <AsyncButton onClick={() => mint()} disabled={!label || scopes.length === 0}>
                {t('keys.create')}
              </AsyncButton>
              <Button variant="secondary" onClick={() => setMinting(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {revealed ? (
        <Modal
          title={t('keys.modalRevealed')}
          onClose={() => (acknowledged ? setRevealed(null) : undefined)}
          dismissible={false}
        >
          <div className="stack">
            <div className="key-reveal">
              <p className="body-strong" style={{ margin: 0 }}>
                {revealed.label}
              </p>
              <span className="key-reveal__value">{revealed.key}</span>
              <p className="body" style={{ margin: 0 }}>
                {t('keys.shownOnce')}
              </p>
            </div>
            <div className="cluster">
              <Button
                icon={<Icon name="copy" />}
                onClick={() => {
                  void navigator.clipboard.writeText(revealed.key);
                }}
              >
                {t('keys.copy')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setAcknowledged(true);
                  setRevealed(null);
                }}
              >
                {t('keys.stored')}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
