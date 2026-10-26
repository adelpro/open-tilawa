import { useEffect, useRef, useState } from 'react';
import { Tabs } from '../components/Tabs';
import type { ReactElement } from 'react';
import { api, apiUpload } from '../lib/api';
import { squareAvatar } from '../lib/avatar';
import { relative } from '../lib/format';
import { useSession } from '../lib/session';
import { LOCALES, LOCALE_NAMES, useI18n } from '../lib/i18n';
import type { Locale } from '../lib/i18n';
import type { Session } from '../lib/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import { AsyncButton } from '../components/AsyncButton';
import { Field, Input, TextArea } from '../components/Field';
import { PasswordField } from '../components/fields';
import { Chip, Notice } from '../components/Chip';
import { Panel } from '../components/Panel';
import { ThemeToggle } from '../components/ThemeToggle';

/**
 * The account itself: language, name, photo, password, the second factor, the
 * signed-in devices, and the one irreversible action.
 *
 * Deleting requires typing the account's email — the design's rule that an
 * irreversible action states its consequence in words, next to the button.
 */
export function Account(): ReactElement {
  const { user, refresh, signOut } = useSession();
  const { t, locale, setLocale, saving } = useI18n();
  const [name, setName] = useState(user?.name ?? '');
  type AccountTab = 'profile' | 'master' | 'photo' | 'password' | 'email';
  const [tab, setTab] = useState<AccountTab>('profile');
  const [about, setAbout] = useState(user?.about ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masterName, setMasterName] = useState('');
  const [masterBody, setMasterBody] = useState('');
  const [masterMessage, setMasterMessage] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMismatch, setPasswordMismatch] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  const [qr, setQr] = useState<string | null>(null);
  const [totp, setTotp] = useState('');
  const [twoFactorMessage, setTwoFactorMessage] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [confirmEmail, setConfirmEmail] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailTotp, setEmailTotp] = useState('');
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [transferEmail, setTransferEmail] = useState('');
  const [transferPassword, setTransferPassword] = useState('');
  const [transferTotp, setTransferTotp] = useState('');
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [avatarMessage, setAvatarMessage] = useState<string | null>(null);
  const [identities, setIdentities] = useState<{ provider: string; email: string }[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [signInMessage, setSignInMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        setSessions(await api<Session[]>('/tokens'));
      } catch {
        // A failed device list is not worth an error banner: the rest of the page works.
      }
    })();

    void (async () => {
      try {
        const [linked, available] = await Promise.all([
          api<{ identities: { provider: string; email: string }[] }>('/me/identities'),
          api<{ providers: string[] }>('/auth/providers'),
        ]);
        setIdentities(linked.identities);
        setProviders(available.providers);
      } catch {
        // Same reasoning: the rest of the page still works without this section.
      }
    })();
  }, []);

  const disconnect = async (provider: string): Promise<void> => {
    setSignInMessage(null);
    try {
      await api(`/me/identities/${provider}`, { method: 'DELETE' });
      setIdentities((current) => current.filter((entry) => entry.provider !== provider));
      setSignInMessage(t('account.signin.disconnected', { provider }));
    } catch (caught) {
      // The refusal is the useful part: "set a password first" is an instruction.
      setSignInMessage(
        caught instanceof Error ? caught.message : t('account.signin.disconnectFailed'),
      );
    }
  };

  // Follow the account, not the first render: the session may still be loading when
  // this screen mounts, and a save elsewhere should not leave a stale copy here.
  useEffect(() => {
    setMasterName(user?.masterName ?? '');
    setMasterBody(user?.masterBody ?? '');
  }, [user?.masterName, user?.masterBody]);

  const saveMaster = async (): Promise<void> => {
    setError(null);
    setMasterMessage(null);
    const name = masterName.trim();
    const body = masterBody.trim();
    // The API refuses half a pair; say so before the round trip.
    if ((name && !body) || (!name && body)) {
      setError(t('prefs.master.pairRequired'));
      return;
    }
    try {
      await api('/me', { method: 'PATCH', body: { user: { masterName, masterBody } } });
      await refresh();
      setMasterMessage(name ? t('prefs.master.saved') : t('prefs.master.cleared'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('prefs.master.saveFailed'));
    }
  };

  const clearMaster = async (): Promise<void> => {
    setError(null);
    setMasterMessage(null);
    try {
      await api('/me', { method: 'PATCH', body: { user: { masterName: '', masterBody: '' } } });
      setMasterName('');
      setMasterBody('');
      await refresh();
      setMasterMessage(t('prefs.master.cleared'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('prefs.master.saveFailed'));
    }
  };

  const saveProfile = async (): Promise<void> => {
    setError(null);
    setSaved(false);
    try {
      await api('/me', { method: 'PATCH', body: { user: { name, about } } });
      await refresh();
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.profile.saveFailed'));
    }
  };

  const changePassword = async (): Promise<void> => {
    setError(null);
    setPasswordMessage(null);
    setPasswordMismatch(null);
    if (confirmPassword !== newPassword) {
      setPasswordMismatch(t('signup.mismatch'));
      return;
    }
    try {
      await api('/me/update-password', {
        method: 'POST',
        body: { oldPassword, newPassword },
      });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMismatch(null);
      setPasswordMessage(t('account.password.changed'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.password.changeFailed'));
    }
  };

  const requestEmailChange = async (): Promise<void> => {
    setError(null);
    setEmailMessage(null);
    try {
      const result = await api<{ message: string }>('/me/email-change', {
        method: 'POST',
        body: { newEmail, password: emailPassword, totp: emailTotp.trim() || undefined },
      });
      setNewEmail('');
      setEmailPassword('');
      setEmailTotp('');
      setEmailMessage(result.message || t('account.email.sent'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.email.failed'));
    }
  };

  const transferOwnership = async (): Promise<void> => {
    setError(null);
    setTransferMessage(null);
    try {
      const result = await api<{ message: string }>('/me/owner-transfer', {
        method: 'POST',
        body: {
          email: transferEmail,
          password: transferPassword,
          totp: transferTotp.trim() || undefined,
        },
      });
      setTransferEmail('');
      setTransferPassword('');
      setTransferTotp('');
      setTransferMessage(result.message || t('account.owner.transferSent'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.owner.transferSent'));
    }
  };

  const startTwoFactor = async (): Promise<void> => {
    setError(null);
    try {
      const enrolment = await api<{ qrcode: string | null }>('/2fa/enable');
      setQr(enrolment.qrcode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.twofa.startFailed'));
    }
  };

  const confirmTwoFactor = async (): Promise<void> => {
    setError(null);
    setTwoFactorMessage(null);
    try {
      const result = await api<{ message: string; enrolled: boolean; recoveryCodes?: string[] }>(
        '/2fa/verify',
        {
          method: 'POST',
          body: { TOTP: totp.trim() },
        },
      );
      setTotp('');
      setQr(null);
      await refresh();
      setTwoFactorMessage(result.enrolled ? t('account.twofa.enrolled') : result.message);
      if (result.recoveryCodes && result.recoveryCodes.length > 0) {
        setRecoveryCodes(result.recoveryCodes);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.twofa.codeFailed'));
    }
  };

  const regenerateRecoveryCodes = async (): Promise<void> => {
    setError(null);
    setRecoveryMessage(null);
    setRecoveryBusy(true);
    try {
      const result = await api<{ codes: string[] }>('/2fa/recovery/regenerate', {
        method: 'POST',
        body: { code: recoveryCode },
      });
      setRecoveryCodes(result.codes);
      setRecoveryCode('');
      setRecoveryMessage(t('account.twofa.recoveryRegenerated'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.twofa.recoveryFailed'));
    } finally {
      setRecoveryBusy(false);
    }
  };

  const revokeSession = async (session: Session): Promise<void> => {
    if (session.isCurrent) {
      const confirmed = window.confirm(t('account.devices.deleteCurrentConfirm'));
      if (!confirmed) return;
    }
    await api(`/tokens/${session.id}`, { method: 'DELETE' });
    if (session.isCurrent) {
      await signOut();
      return;
    }
    setSessions(await api<Session[]>('/tokens'));
  };

  const uploadAvatar = async (file: File): Promise<void> => {
    setError(null);
    setAvatarMessage(null);
    try {
      const blob = await squareAvatar(file);
      await apiUpload('/me/avatar', blob, 'image/jpeg');
      await refresh();
      setAvatarMessage(t('account.photo.updated'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.photo.failed'));
    }
  };

  const removeAvatar = async (): Promise<void> => {
    setError(null);
    setAvatarMessage(null);
    try {
      await api('/me/avatar', { method: 'DELETE' });
      await refresh();
      setAvatarMessage(t('account.photo.removed'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('account.photo.removeFailed'));
    }
  };

  const deleteAccount = async (): Promise<void> => {
    if (user?.isOwner) {
      setError(t('account.owner.deleteHint'));
      return;
    }
    if (confirmEmail !== user?.email) return;
    await api('/me', { method: 'DELETE' });
    await signOut();
  };

  return (
    <div className="stack">
      <div>
        <h1 className="display-lg">{t('account.title')}</h1>
        <p className="body muted">
          {user?.email} {user?.isOwner ? <Chip tone="info">{t('account.owner')}</Chip> : null}
        </p>
      </div>

      <Tabs
        items={[
          { id: 'profile', label: t('account.profile.title') },
          { id: 'master', label: t('editor.kind.master') },
          { id: 'photo', label: t('account.photo.title') },
          { id: 'password', label: t('account.password.title') },
          { id: 'email', label: t('account.email.title') },
        ]}
        active={tab}
        onChange={setTab}
        label={t('account.title')}
      />

      {tab === 'profile' ? (
        <>
          <h2 className="group-title">{t('account.group.profile')}</h2>

          <Panel tone="parchment">
            <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
              {t('prefs.title')}
            </h3>
            <div className="stack stack--tight">
              <Field label={t('prefs.language')} hint={t('prefs.languageHint')}>
                {(id) => (
                  <select
                    id={id}
                    className="input"
                    value={locale}
                    disabled={saving}
                    onChange={(event) => void setLocale(event.target.value as Locale)}
                    // `lang` on the control keeps each name in its own language even while
                    // it is listed inside the other one.
                  >
                    {LOCALES.map((option) => (
                      <option key={option} value={option} lang={option}>
                        {LOCALE_NAMES[option]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label={t('prefs.theme')}>{() => <ThemeToggle />}</Field>
            </div>
          </Panel>
        </>
      ) : null}

      {tab === 'master' ? (
        <Panel tone="parchment">
          <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
            {t('prefs.master.title')}
          </h3>
          <div className="stack">
            <p className="fine-print">{t('prefs.master.hint')}</p>
            <Field label={t('prefs.master.name')}>
              {(id) => (
                <Input
                  id={id}
                  name="master-name"
                  autoComplete="off"
                  value={masterName}
                  onChange={(event) => setMasterName(event.target.value)}
                />
              )}
            </Field>
            <Field label={t('prefs.master.body')} hint={t('prefs.master.bodyHint')}>
              {(id) => (
                <TextArea
                  id={id}
                  name="master-body"
                  rows={7}
                  value={masterBody}
                  onChange={(event) => setMasterBody(event.target.value)}
                />
              )}
            </Field>
            <div className="cluster">
              <AsyncButton onClick={() => saveMaster()}>{t('prefs.master.save')}</AsyncButton>
              {user?.masterName || user?.masterBody ? (
                <Button variant="tertiary" onClick={() => void clearMaster()}>
                  {t('prefs.master.clear')}
                </Button>
              ) : null}
            </div>
            {masterMessage ? <Notice tone="ok">{masterMessage}</Notice> : null}
          </div>
        </Panel>
      ) : null}

      {tab === 'photo' ? (
        <Panel>
          <div className="spread" style={{ marginBottom: 'var(--space-4)' }}>
            <h3 className="display-sm">{t('account.photo.title')}</h3>
            {user ? (
              <Chip tone="info">
                {user.avatarUpdatedAt ? t('account.photo.uploaded') : t('account.photo.fallback')}
              </Chip>
            ) : null}
          </div>
          <div className="avatar-drop">
            {user ? (
              <Avatar
                userId={user.id}
                name={user.name}
                email={user.email}
                avatarUpdatedAt={user.avatarUpdatedAt}
                size={64}
              />
            ) : null}
            <div className="cluster">
              <Button variant="secondary" onClick={() => fileInput.current?.click()}>
                {t('account.photo.choose')}
              </Button>
              {user?.avatarUpdatedAt ? (
                <Button variant="tertiary" onClick={() => void removeAvatar()}>
                  {t('account.photo.remove')}
                </Button>
              ) : null}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void uploadAvatar(file);
                }}
              />
            </div>
          </div>
          <p className="fine-print" style={{ marginTop: 'var(--space-4)' }}>
            {t('account.photo.note')}
          </p>
          {avatarMessage ? <Notice tone="ok">{avatarMessage}</Notice> : null}
        </Panel>
      ) : null}

      {error ? <Notice tone="bad">{error}</Notice> : null}
      {saved ? <Notice tone="ok">{t('prefs.saved')}</Notice> : null}

      {tab === 'profile' ? (
        <>
          <Panel>
            <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
              {t('account.profile.title')}
            </h3>
            <div className="stack">
              <Field label={t('common.name')}>
                {(id) => (
                  <Input
                    id={id}
                    name="name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                )}
              </Field>
              <Field label={t('account.profile.about')} hint={t('account.profile.aboutHint')}>
                {(id) => (
                  <Input
                    id={id}
                    name="about"
                    autoComplete="off"
                    value={about}
                    onChange={(event) => setAbout(event.target.value)}
                  />
                )}
              </Field>
              <div>
                <AsyncButton onClick={() => saveProfile()}>{t('common.save')}</AsyncButton>
              </div>
            </div>
          </Panel>

          <Panel>
            <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
              {t('account.signin.title')}
            </h3>
            <div className="stack">
              <p className="body">
                {user?.passwordSet === false ? (
                  <>
                    <strong>{t('account.signin.noPasswordLead')}</strong>{' '}
                    {t('account.signin.noPasswordBody')}
                  </>
                ) : (
                  t('account.signin.hasPassword')
                )}
              </p>

              {identities.map((identity) => (
                <div key={identity.provider} className="spread">
                  <span className="body">
                    <code>{identity.provider}</code> <span className="muted">{identity.email}</span>
                  </span>
                  <Button
                    variant="tertiary"
                    small
                    onClick={() => void disconnect(identity.provider)}
                  >
                    {t('account.signin.disconnect')}
                  </Button>
                </div>
              ))}

              {providers
                .filter((provider) => !identities.some((entry) => entry.provider === provider))
                .map((provider) => (
                  <a
                    key={provider}
                    className="btn btn--secondary btn--sm"
                    href={`/api/auth/${provider}/link`}
                  >
                    {t('account.signin.connect', { provider })}
                  </a>
                ))}

              {signInMessage ? <Notice tone="ok">{signInMessage}</Notice> : null}
              {providers.length === 0 ? (
                <p className="fine-print">{t('account.signin.none')}</p>
              ) : null}
            </div>
          </Panel>
        </>
      ) : null}

      <h2 className="group-title">{t('account.group.security')}</h2>

      {tab === 'password' ? (
        <Panel tone="parchment">
          <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
            {t('account.password.title')}
          </h3>
          <div className="stack">
            {user?.passwordSet === false ? (
              <div className="stack">
                <p className="body">{t('account.password.noPassword')}</p>
                <div>
                  <Button
                    onClick={() => {
                      void api('/reset-password/send-email', {
                        method: 'POST',
                        body: { email: user?.email },
                      })
                        .then(() => setPasswordMessage(t('account.password.checkEmail')))
                        .catch((caught: unknown) =>
                          setError(
                            caught instanceof Error
                              ? caught.message
                              : t('account.password.sendFailed'),
                          ),
                        );
                    }}
                  >
                    {t('account.password.sendLink')}
                  </Button>
                </div>
                {passwordMessage ? <Notice tone="ok">{passwordMessage}</Notice> : null}
              </div>
            ) : (
              <>
                <PasswordField
                  label={t('account.password.current')}
                  value={oldPassword}
                  onChange={setOldPassword}
                  autoComplete="current-password"
                  required
                />
                <PasswordField
                  label={t('reset.newPassword')}
                  hint={t('account.password.newHint')}
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  showStrength
                />
                <PasswordField
                  label={t('signup.confirmPassword')}
                  hint={t('signup.confirmHint')}
                  value={confirmPassword}
                  onChange={(next) => {
                    setConfirmPassword(next);
                    if (passwordMismatch && next === newPassword) {
                      setPasswordMismatch(null);
                    }
                  }}
                  autoComplete="new-password"
                  required
                />
                {passwordMismatch ? <Notice tone="bad">{passwordMismatch}</Notice> : null}
                {passwordMessage ? <Notice tone="ok">{passwordMessage}</Notice> : null}
                <div>
                  <Button
                    onClick={() => void changePassword()}
                    disabled={!oldPassword || !newPassword || !confirmPassword}
                  >
                    {t('account.password.change')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Panel>
      ) : null}

      {tab === 'email' ? (
        <Panel tone="parchment">
          <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
            {t('account.email.title')}
          </h3>
          <p className="body muted">{t('account.email.body')}</p>
          <div className="stack">
            <Field label={t('account.email.new')}>
              {(id) => (
                <Input
                  id={id}
                  name="newEmail"
                  type="email"
                  autoComplete="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                />
              )}
            </Field>
            <PasswordField
              label={t('account.password.current')}
              value={emailPassword}
              onChange={setEmailPassword}
              autoComplete="current-password"
              required
            />
            {user?.isTwoFAEnabled ? (
              <Field label={t('account.owner.transferTotp')}>
                {(id) => (
                  <Input
                    id={id}
                    name="email-totp"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={emailTotp}
                    onChange={(event) => setEmailTotp(event.target.value)}
                  />
                )}
              </Field>
            ) : null}
            {emailMessage ? <Notice tone="ok">{emailMessage}</Notice> : null}
            <div>
              <Button
                onClick={() => void requestEmailChange()}
                disabled={!newEmail || !emailPassword}
              >
                {t('account.email.send')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      {user?.isOwner ? (
        <Panel>
          <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
            {t('account.owner.transferTitle')}
          </h3>
          <p className="body muted">{t('account.owner.transferBody')}</p>
          <div className="stack">
            <Field label={t('account.owner.transferEmail')}>
              {(id) => (
                <Input
                  id={id}
                  name="transferEmail"
                  type="email"
                  autoComplete="email"
                  value={transferEmail}
                  onChange={(event) => setTransferEmail(event.target.value)}
                />
              )}
            </Field>
            <PasswordField
              label={t('account.password.current')}
              value={transferPassword}
              onChange={setTransferPassword}
              autoComplete="current-password"
              required
            />
            {user?.isTwoFAEnabled ? (
              <Field label={t('account.owner.transferTotp')}>
                {(id) => (
                  <Input
                    id={id}
                    name="transfer-totp"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={transferTotp}
                    onChange={(event) => setTransferTotp(event.target.value)}
                  />
                )}
              </Field>
            ) : null}
            {transferMessage ? <Notice tone="ok">{transferMessage}</Notice> : null}
            <div>
              <Button
                onClick={() => void transferOwnership()}
                disabled={!transferEmail || !transferPassword}
              >
                {t('account.owner.transferAction')}
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <Panel>
        <div className="spread" style={{ marginBottom: 'var(--space-4)' }}>
          <h3 className="display-sm">{t('account.twofa.title')}</h3>
          <Chip tone={user?.isTwoFAEnabled ? 'ok' : 'notice'}>
            {user?.isTwoFAEnabled ? t('account.twofa.on') : t('account.twofa.off')}
          </Chip>
        </div>
        {user?.isTwoFAEnabled ? (
          <p className="body muted">{t('account.twofa.enabledBody')}</p>
        ) : (
          <div className="stack">
            <p className="body muted">{t('account.twofa.setupBody')}</p>
            {qr ? (
              <div className="stack stack--tight">
                <img src={qr} alt={t('account.twofa.qrAlt')} width={200} height={200} />
                <Field label={t('account.twofa.codeLabel')}>
                  {(id) => (
                    <Input
                      id={id}
                      inputMode="numeric"
                      maxLength={6}
                      value={totp}
                      onChange={(event) => setTotp(event.target.value)}
                    />
                  )}
                </Field>
                <div>
                  <Button onClick={() => void confirmTwoFactor()} disabled={totp.length !== 6}>
                    {t('account.twofa.turnOn')}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <Button onClick={() => void startTwoFactor()}>{t('account.twofa.setup')}</Button>
              </div>
            )}
          </div>
        )}
        {twoFactorMessage ? <Notice tone="ok">{twoFactorMessage}</Notice> : null}
        {recoveryCodes && recoveryCodes.length > 0 ? (
          <div className="stack" style={{ marginTop: 'var(--space-3)' }}>
            <h4 className="display-sm">{t('account.twofa.recoveryTitle')}</h4>
            <p className="body muted">{t('account.twofa.recoveryBody')}</p>
            <pre
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.9rem',
                lineHeight: 1.8,
                padding: 'var(--space-3)',
                background: 'var(--color-surface-sunken, #f5f5f7)',
                borderRadius: 'var(--radius-sm, 8px)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {recoveryCodes.join('\n')}
            </pre>
            <div>
              <Button variant="tertiary" onClick={() => setRecoveryCodes(null)}>
                {t('account.twofa.recoveryDismiss')}
              </Button>
            </div>
          </div>
        ) : null}
        {user?.isTwoFAEnabled ? (
          <div className="stack" style={{ marginTop: 'var(--space-4)' }}>
            <Field label={t('account.twofa.recoveryCodeLabel')}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  maxLength={6}
                  value={recoveryCode}
                  onChange={(event) => setRecoveryCode(event.target.value)}
                />
              )}
            </Field>
            <div>
              <Button
                onClick={() => void regenerateRecoveryCodes()}
                disabled={recoveryBusy || !recoveryCode}
              >
                {recoveryBusy ? t('twofa.checking') : t('account.twofa.recoveryRegenerate')}
              </Button>
            </div>
            {recoveryMessage ? <Notice tone="ok">{recoveryMessage}</Notice> : null}
          </div>
        ) : null}
      </Panel>

      <Panel tone="parchment">
        <h3 className="display-sm" style={{ marginBottom: 'var(--space-4)' }}>
          {t('account.devices.title')}
        </h3>
        {sessions.length === 0 ? (
          <p className="body muted">{t('account.devices.none')}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('account.devices.device')}</th>
                  <th>{t('account.devices.signedIn')}</th>
                  <th aria-label={t('account.devices.actions')} />
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <div className="stack stack--tight">
                        <code className="truncate" style={{ maxWidth: '18rem' }}>
                          {session.label ?? `#${session.id}`}
                        </code>
                        <div className="cluster">
                          {session.isCurrent ? (
                            <Chip tone="info">{t('account.devices.thisDevice')}</Chip>
                          ) : null}
                          {session.isTrusted ? (
                            <Chip tone="ok">{t('account.devices.trusted')}</Chip>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="muted">{relative(session.createdAt ?? null, locale)}</td>
                    <td className="num">
                      <Button
                        variant="destructive"
                        small
                        onClick={() => void revokeSession(session)}
                      >
                        {t('account.devices.delete')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <h2 className="group-title">{t('account.group.danger')}</h2>

      <Panel>
        <h3 className="display-sm" style={{ color: 'var(--error)' }}>
          {t('account.delete.title')}
        </h3>
        <p className="body muted">{t('account.delete.body')}</p>
        {user?.isOwner ? <Notice tone="notice">{t('account.owner.deleteHint')}</Notice> : null}
        <div className="stack stack--tight">
          <Field label={t('account.delete.confirm', { email: user?.email ?? t('common.email') })}>
            {(id) => (
              <Input
                id={id}
                name="confirm-email"
                autoComplete="off"
                value={confirmEmail}
                onChange={(event) => setConfirmEmail(event.target.value)}
              />
            )}
          </Field>
          <div>
            <Button
              variant="destructive"
              onClick={() => void deleteAccount()}
              disabled={user?.isOwner || confirmEmail !== user?.email}
            >
              {t('account.delete.action')}
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
