import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { CodeField } from '../components/fields';
import { Notice } from '../components/Chip';

/**
 * The second factor, for a device the account has not trusted yet.
 *
 * A correct code also **enrols** 2FA on an account that has not switched it on:
 * the API treats the first verified code as both proof and enrolment, so this
 * screen is how 2FA is turned on at all.
 *
 * The email path exists for one situation — the authenticator is gone. It buys a
 * single sign-in: the API deliberately does not add this device to the trusted
 * list, so the next sign-in here asks again.
 */
export function TwoFactor(): ReactElement {
  const { refresh } = useSession();
  const { t } = useI18n();
  const [mode, setMode] = useState<'authenticator' | 'email' | 'recovery'>('authenticator');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTo = (next: 'authenticator' | 'email' | 'recovery'): void => {
    setMode(next);
    setCode('');
    setError(null);
    setNotice(null);
  };

  const submitAuthenticator = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/2fa/verify', { method: 'POST', body: { TOTP: code.trim() } });
      await refresh();
      navigate('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('twofa.failed'));
    } finally {
      setBusy(false);
    }
  };

  const submitEmailCode = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/2fa/email-code/verify', { method: 'POST', body: { code: code.trim() } });
      await refresh();
      navigate('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('twofa.failed'));
    } finally {
      setBusy(false);
    }
  };

  const submitRecovery = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/2fa/recovery', { method: 'POST', body: { code: code.trim() } });
      await refresh();
      navigate('/');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('twofa.failed'));
    } finally {
      setBusy(false);
    }
  };

  const sendEmailCode = async (): Promise<void> => {
    setError(null);
    setBusy(true);
    try {
      await api('/2fa/email-code', { method: 'POST' });
      setMode('email');
      setCode('');
      setNotice(t('twofa.emailSent'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('twofa.emailFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth">
      <div className="auth__card stack">
        <div>
          <h1 className="display-lg">{t('twofa.title')}</h1>
          <p className="body muted">
            {mode === 'email'
              ? t('twofa.emailLede')
              : mode === 'recovery'
                ? t('twofa.recoveryLede')
                : t('twofa.lede')}
          </p>
        </div>

        {error ? <Notice tone="bad">{error}</Notice> : null}
        {notice ? <Notice tone="info">{notice}</Notice> : null}

        {mode === 'authenticator' ? (
          <form className="stack" onSubmit={(event) => void submitAuthenticator(event)}>
            <CodeField
              label={t('twofa.code')}
              value={code}
              onChange={setCode}
              required
              maxLength={6}
              pattern="[0-9]{6}"
            />
            <div className="cluster">
              <Button type="submit" busy={busy}>
                {busy ? t('twofa.checking') : t('twofa.submit')}
              </Button>
              <Button variant="tertiary" onClick={() => navigate('/signin')}>
                {t('common.back')}
              </Button>
            </div>
            <Button variant="tertiary" busy={busy} onClick={() => void sendEmailCode()}>
              {t('twofa.emailLink')}
            </Button>
            <Button variant="tertiary" onClick={() => switchTo('recovery')}>
              {t('twofa.recoveryLink')}
            </Button>
          </form>
        ) : mode === 'recovery' ? (
          <form className="stack" onSubmit={(event) => void submitRecovery(event)}>
            <CodeField
              label={t('twofa.recoveryCode')}
              value={code}
              onChange={setCode}
              required
              maxLength={16}
            />
            <div className="cluster">
              <Button type="submit" busy={busy}>
                {busy ? t('twofa.checking') : t('twofa.recoverySubmit')}
              </Button>
              <Button variant="tertiary" onClick={() => switchTo('authenticator')}>
                {t('twofa.emailBack')}
              </Button>
            </div>
          </form>
        ) : (
          <form className="stack" onSubmit={(event) => void submitEmailCode(event)}>
            <CodeField
              label={t('twofa.emailCode')}
              value={code}
              onChange={setCode}
              required
              maxLength={6}
              pattern="[0-9]{6}"
            />
            <div className="cluster">
              <Button type="submit" busy={busy}>
                {busy ? t('twofa.checking') : t('twofa.emailSubmit')}
              </Button>
              <Button variant="tertiary" onClick={() => switchTo('authenticator')}>
                {t('twofa.emailBack')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
