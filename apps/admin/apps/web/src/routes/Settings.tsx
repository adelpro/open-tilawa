import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';
import { Button } from '../components/Button';
import { Field, Input, TextArea } from '../components/Field';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { ConfirmModal } from '../components/ConfirmModal';
import { Tabs } from '../components/Tabs';

type Tls = 'ssl' | 'starttls' | 'none';
type AlertKind = 'service.down' | 'seeder.offline' | 'seeder.disk' | 'seeder.update_failed';

interface MailState {
  host: string | null;
  port: number;
  tls: Tls;
  user: string | null;
  from: string | null;
  hasPassword: boolean;
  verifiedAt: string | null;
  source: 'db' | 'env' | 'none';
}

interface NotifyState {
  enabled: AlertKind[];
  serviceFailures: number;
  diskFloorBytes: number;
  extraRecipients: string[];
  digest: { enabled: boolean; hourUtc: number };
}

interface AlertRow {
  id: number;
  kind: AlertKind;
  subject: string;
  title: string;
  state: 'open' | 'resolved';
  openedAt: string;
  notifyError: string | null;
}

const KINDS: AlertKind[] = [
  'service.down',
  'seeder.offline',
  'seeder.disk',
  'seeder.update_failed',
];

const KIND_KEY: Record<AlertKind, MessageKey> = {
  'service.down': 'settings.alerts.kind.service.down',
  'seeder.offline': 'settings.alerts.kind.seeder.offline',
  'seeder.disk': 'settings.alerts.kind.seeder.disk',
  'seeder.update_failed': 'settings.alerts.kind.seeder.update_failed',
};

const SOURCE_KEY: Record<MailState['source'], MessageKey> = {
  db: 'settings.mail.source.db',
  env: 'settings.mail.source.env',
  none: 'settings.mail.source.none',
};

const GiB = 1024 ** 3;

const EMPTY_FORM = {
  host: '',
  port: '465',
  tls: 'ssl' as Tls,
  user: '',
  from: '',
  password: '',
};

/**
 * Outbound mail and the alerts built on it.
 *
 * Two things are deliberately explicit here. The source line says whether the
 * running transport comes from this screen or from the environment — a
 * configuration that is saved but not in use is the failure mode this screen
 * exists to prevent. And the alert list shows failures to send, because a rule
 * that fires into a broken mailer looks exactly like a rule that never fired.
 */
export function Settings(): ReactElement {
  const { t, locale } = useI18n();
  const [mail, setMail] = useState<MailState | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [rules, setRules] = useState<NotifyState | null>(null);
  const [recipients, setRecipients] = useState('');
  const [history, setHistory] = useState<AlertRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [skipVerify, setSkipVerify] = useState(false);
  const [tab, setTab] = useState<'mail' | 'alerts'>('mail');

  const load = useCallback(async () => {
    try {
      const [mailState, notify, alerts] = await Promise.all([
        api<MailState>('/settings/mail'),
        api<NotifyState>('/settings/notifications'),
        api<AlertRow[]>('/alerts?limit=20'),
      ]);
      setMail(mailState);
      setForm({
        host: mailState.host ?? '',
        port: String(mailState.port),
        tls: mailState.tls,
        user: mailState.user ?? '',
        from: mailState.from ?? '',
        password: '',
      });
      setRules(notify);
      setRecipients(notify.extraRecipients.join('\n'));
      setHistory(alerts);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('settings.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveMail(): Promise<void> {
    setBusy('mail');
    setError(null);
    setMessage(null);
    try {
      const next = await api<MailState>('/settings/mail', {
        method: 'PUT',
        body: {
          host: form.host.trim(),
          port: Number(form.port),
          tls: form.tls,
          user: form.user.trim(),
          from: form.from.trim(),
          // Omitted, not empty: the API treats a missing password as "keep".
          password: form.password === '' ? undefined : form.password,
          // Relays that reject nodemailer's probe still send fine; the plan offers
          // an explicit override, so the console has to expose it.
          force: skipVerify || undefined,
        },
      });
      setMail(next);
      setForm((current) => ({ ...current, password: '' }));
      setMessage(t('settings.mail.saved'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('settings.mail.saveFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function sendTest(): Promise<void> {
    setBusy('test');
    setError(null);
    setMessage(null);
    try {
      await api('/settings/mail/test', { method: 'POST' });
      setMessage(t('settings.mail.testSent'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('settings.mail.testFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function clearMail(): Promise<void> {
    setBusy('clear');
    try {
      const next = await api<MailState>('/settings/mail', { method: 'DELETE' });
      setMail(next);
      setForm((current) => ({ ...current, ...EMPTY_FORM, port: String(next.port), tls: next.tls }));
      setMessage(t('settings.mail.cleared'));
      setConfirming(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('settings.mail.saveFailed'));
    } finally {
      setBusy(null);
    }
  }

  async function saveRules(): Promise<void> {
    setBusy('rules');
    setError(null);
    setMessage(null);
    try {
      const next = await api<NotifyState>('/settings/notifications', {
        method: 'PUT',
        body: {
          enabled: rules?.enabled ?? KINDS,
          serviceFailures: rules?.serviceFailures ?? 3,
          diskFloorBytes: rules?.diskFloorBytes ?? 20 * GiB,
          digest: rules?.digest,
          extraRecipients: recipients
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean),
        },
      });
      setRules(next);
      setRecipients(next.extraRecipients.join('\n'));
      setMessage(t('settings.alerts.saved'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('settings.alerts.saveFailed'));
    } finally {
      setBusy(null);
    }
  }

  function toggle(kind: AlertKind): void {
    setRules((current) => {
      if (!current) return current;
      const enabled = current.enabled.includes(kind)
        ? current.enabled.filter((entry) => entry !== kind)
        : [...current.enabled, kind];
      return { ...current, enabled };
    });
  }

  return (
    <div className="stack">
      <header className="page-head">
        <div>
          <h1 className="display-lg">{t('settings.title')}</h1>
          <p className="body muted">{t('settings.subtitle')}</p>
        </div>
      </header>

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {message ? <Notice tone="ok">{message}</Notice> : null}

      <Tabs
        items={[
          { id: 'mail', label: t('settings.tab.mail') },
          { id: 'alerts', label: t('settings.tab.alerts') },
        ]}
        active={tab}
        onChange={setTab}
        label={t('settings.tabs')}
      />

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack">
        {tab === 'mail' ? (
          <Panel>
            <div className="stack">
              <div className="stack stack--tight">
                <h2 className="h2">{t('settings.mail.title')}</h2>
                <p className="muted">{t('settings.mail.body')}</p>
              </div>

              {mail ? (
                <p className="row__meta">
                  <Chip tone={mail.source === 'db' ? 'ok' : mail.source === 'env' ? 'info' : 'bad'}>
                    {t(SOURCE_KEY[mail.source])}
                  </Chip>{' '}
                  {mail.source === 'db' && mail.verifiedAt
                    ? t('settings.mail.verified', {
                        when: new Date(mail.verifiedAt).toLocaleString(locale),
                      })
                    : null}
                </p>
              ) : null}

              <Field label={t('settings.mail.host')}>
                {(id) => (
                  <Input
                    id={id}
                    value={form.host}
                    onChange={(event) => setForm({ ...form, host: event.target.value })}
                    placeholder="smtp.example.com"
                    autoComplete="off"
                  />
                )}
              </Field>

              <div className="field-row">
                <Field label={t('settings.mail.port')}>
                  {(id) => (
                    <Input
                      id={id}
                      value={form.port}
                      inputMode="numeric"
                      onChange={(event) => setForm({ ...form, port: event.target.value })}
                    />
                  )}
                </Field>
                <Field label={t('settings.mail.tls')}>
                  {(id) => (
                    <select
                      id={id}
                      className="field__select"
                      value={form.tls}
                      onChange={(event) => setForm({ ...form, tls: event.target.value as Tls })}
                    >
                      <option value="ssl">{t('settings.mail.tls.ssl')}</option>
                      <option value="starttls">{t('settings.mail.tls.starttls')}</option>
                      <option value="none">{t('settings.mail.tls.none')}</option>
                    </select>
                  )}
                </Field>
              </div>

              <Field label={t('settings.mail.user')}>
                {(id) => (
                  <Input
                    id={id}
                    value={form.user}
                    onChange={(event) => setForm({ ...form, user: event.target.value })}
                    autoComplete="off"
                  />
                )}
              </Field>

              <Field label={t('settings.mail.from')} hint={t('settings.mail.fromHint')}>
                {(id) => (
                  <Input
                    id={id}
                    value={form.from}
                    onChange={(event) => setForm({ ...form, from: event.target.value })}
                    autoComplete="off"
                  />
                )}
              </Field>

              <Field
                label={t('settings.mail.password')}
                hint={
                  mail?.hasPassword
                    ? t('settings.mail.passwordSet')
                    : t('settings.mail.passwordKeep')
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    autoComplete="new-password"
                  />
                )}
              </Field>

              <label className="row">
                <input
                  type="checkbox"
                  checked={skipVerify}
                  onChange={(event) => setSkipVerify(event.target.checked)}
                />{' '}
                {t('settings.mail.skipVerify')}
              </label>

              <div className="cluster">
                <Button onClick={() => void saveMail()} busy={busy === 'mail'}>
                  {t('settings.mail.save')}
                </Button>
                <Button variant="secondary" onClick={() => void sendTest()} busy={busy === 'test'}>
                  {t('settings.mail.test')}
                </Button>
                {mail?.source === 'db' ? (
                  <Button variant="tertiary" onClick={() => setConfirming(true)}>
                    {t('settings.mail.clear')}
                  </Button>
                ) : null}
              </div>
            </div>
          </Panel>
        ) : null}

        {tab === 'alerts' ? (
          <Panel>
            <div className="stack">
              <div className="stack stack--tight">
                <h2 className="h2">{t('settings.alerts.title')}</h2>
                <p className="muted">{t('settings.alerts.body')}</p>
              </div>

              {rules ? (
                <>
                  {KINDS.map((kind) => (
                    <label className="row" key={kind}>
                      <input
                        type="checkbox"
                        checked={rules.enabled.includes(kind)}
                        onChange={() => toggle(kind)}
                      />{' '}
                      {t(KIND_KEY[kind])}
                    </label>
                  ))}

                  <div className="field-row">
                    <Field label={t('settings.alerts.serviceFailures')}>
                      {(id) => (
                        <Input
                          id={id}
                          value={String(rules.serviceFailures)}
                          inputMode="numeric"
                          onChange={(event) =>
                            setRules({ ...rules, serviceFailures: Number(event.target.value) || 1 })
                          }
                        />
                      )}
                    </Field>
                    <Field label={t('settings.alerts.diskFloor')}>
                      {(id) => (
                        <Input
                          id={id}
                          value={String(Math.round((rules.diskFloorBytes / GiB) * 10) / 10)}
                          inputMode="decimal"
                          onChange={(event) =>
                            setRules({
                              ...rules,
                              diskFloorBytes: Math.max(0, Number(event.target.value) || 0) * GiB,
                            })
                          }
                        />
                      )}
                    </Field>
                  </div>

                  <Field
                    label={t('settings.alerts.recipients')}
                    hint={t('settings.alerts.recipientsHint')}
                  >
                    {(id) => (
                      <TextArea
                        id={id}
                        rows={3}
                        value={recipients}
                        onChange={(event) => setRecipients(event.target.value)}
                      />
                    )}
                  </Field>

                  <div className="stack stack--tight">
                    <label className="row">
                      <input
                        type="checkbox"
                        checked={rules.digest.enabled}
                        onChange={(event) =>
                          setRules({
                            ...rules,
                            digest: { ...rules.digest, enabled: event.target.checked },
                          })
                        }
                      />{' '}
                      {t('settings.alerts.digest')}
                    </label>
                    <p className="muted">{t('settings.alerts.digestHint')}</p>
                    <div className="field-row field-row--compact">
                      <Field label={t('settings.alerts.digestHour')}>
                        {(id) => (
                          <Input
                            id={id}
                            value={String(rules.digest.hourUtc)}
                            inputMode="numeric"
                            disabled={!rules.digest.enabled}
                            onChange={(event) =>
                              setRules({
                                ...rules,
                                digest: {
                                  ...rules.digest,
                                  // The API rejects anything outside 0-23; clamping
                                  // here keeps a slip from failing the whole save.
                                  hourUtc: Math.min(
                                    23,
                                    Math.max(0, Number(event.target.value) || 0),
                                  ),
                                },
                              })
                            }
                          />
                        )}
                      </Field>
                    </div>
                  </div>

                  <div className="cluster">
                    <Button onClick={() => void saveRules()} busy={busy === 'rules'}>
                      {t('settings.alerts.save')}
                    </Button>
                  </div>
                </>
              ) : null}

              <div className="stack stack--tight">
                <h3 className="h3">{t('settings.alerts.history')}</h3>
                {history.length === 0 ? (
                  <p className="muted">{t('settings.alerts.empty')}</p>
                ) : (
                  <ul className="stack stack--tight">
                    {history.map((row) => (
                      <li key={row.id} className="row">
                        <span className="grow stack stack--tight" style={{ gap: 2 }}>
                          <span className="row__label">{row.title}</span>
                          <span className="row__meta">
                            {new Date(row.openedAt).toLocaleString(locale)}
                            {row.notifyError
                              ? ` · ${t('settings.alerts.notifyFailed')}: ${row.notifyError}`
                              : ''}
                          </span>
                        </span>
                        <Chip tone={row.state === 'open' ? 'bad' : 'ok'}>
                          {row.state === 'open'
                            ? t('settings.alerts.state.open')
                            : t('settings.alerts.state.resolved')}
                        </Chip>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Panel>
        ) : null}
      </div>

      {confirming ? (
        <ConfirmModal
          title={t('settings.mail.clearTitle')}
          body={t('settings.mail.clearBody')}
          confirmLabel={t('settings.mail.clear')}
          destructive
          busy={busy === 'clear'}
          onConfirm={() => void clearMail()}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </div>
  );
}
