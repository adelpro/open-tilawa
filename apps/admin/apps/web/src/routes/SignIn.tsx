import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { ApiError, api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { EmailField, PasswordField } from '../components/fields';
import { Notice } from '../components/Chip';

/**
 * Sign in. Four answers matter and each has its own destination:
 * 200 → the dashboard, 430 → the 2FA code screen, 403 → "activate first",
 * 409 → this account belongs to a provider, and the message says which one.
 */
export function SignIn(): ReactElement {
  const { refresh } = useSession();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNeedsActivation(false);
    setResendMessage(null);
    setBusy(true);
    try {
      await api('/auth/local/signin', { method: 'POST', body: { user: { email, password } } });
      await refresh();
      navigate('/');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 430) {
        navigate('/2fa');
        return;
      }
      const message = caught instanceof Error ? caught.message : t('auth.signIn.failed');
      setError(message);
      setNeedsActivation(/not activated/i.test(message));
    } finally {
      setBusy(false);
    }
  };

  const resendActivation = async (): Promise<void> => {
    if (!email) return;
    setResendBusy(true);
    setResendMessage(null);
    try {
      await api('/auth/local/resend-activation', { method: 'POST', body: { email } });
      setResendMessage(t('auth.signIn.resendSent'));
    } catch (caught) {
      setResendMessage(caught instanceof Error ? caught.message : t('auth.signIn.resendFailed'));
    } finally {
      setResendBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card stack">
        <div>
          <h1 className="display-lg">{t('auth.signIn.title')}</h1>
          <p className="body muted">{t('auth.signIn.lede')}</p>
        </div>

        {error ? <Notice tone="bad">{error}</Notice> : null}
        {needsActivation ? (
          <div className="stack stack--tight">
            {resendMessage ? <Notice tone="ok">{resendMessage}</Notice> : null}
            <Button variant="secondary" onClick={() => void resendActivation()} busy={resendBusy}>
              {t('auth.signIn.resendActivation')}
            </Button>
          </div>
        ) : null}

        <form className="stack" onSubmit={(event) => void submit(event)}>
          <EmailField label={t('common.email')} value={email} onChange={setEmail} required />
          <PasswordField
            label={t('common.password')}
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            required
          />
          <div className="cluster">
            <Button type="submit" busy={busy}>
              {t('auth.signIn.submit')}
            </Button>
            <Button variant="tertiary" onClick={() => navigate('/reset-password')}>
              {t('auth.signIn.forgot')}
            </Button>
          </div>
        </form>

        <p className="fine-print">
          {t('auth.signIn.noAccount')}{' '}
          <a
            className="link"
            href="/dashboard/signup"
            onClick={(event) => {
              event.preventDefault();
              navigate('/signup');
            }}
          >
            {t('auth.signIn.createOne')}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
