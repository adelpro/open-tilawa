import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { ApiError, api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import type { MessageKey } from '../lib/i18n';
import { oauthErrorKey } from '../lib/oauth-errors';
import { Button } from '../components/Button';
import { GoogleMark, GitHubMark } from '../components/icons';
import { EmailField, PasswordField } from '../components/fields';
import { Notice } from '../components/Chip';
import { deviceId } from '../lib/device';
import { readLastAuth, writeLastAuth } from '../lib/last-auth';
import type { AuthMethod } from '../lib/last-auth';

const PROVIDER_KEYS: Record<string, MessageKey> = {
  google: 'auth.signIn.providerGoogle',
  github: 'auth.signIn.providerGitHub',
};

/**
 * Sign in. Four answers matter and each has its own destination:
 * 200 → the console, 430 → the 2FA code screen, 403 → "activate first".
 *
 * A provider-only account signing in with a password is deliberately the same
 * generic 401 as a wrong password: naming the provider would turn the form into an
 * account-existence oracle.
 */
export function SignIn(): ReactElement {
  const { refresh } = useSession();
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState<string[]>([]);
  const [needsActivation, setNeedsActivation] = useState(false);
  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  /** Device-local: which method this browser signed in with last. */
  const [lastAuth] = useState<AuthMethod | null>(() => readLastAuth());

  // A provider failure arrives as a redirect, so the reason is in the URL rather
  // than an exception. It is read once; a refresh is a harmless repeat.
  const [providerError] = useState<string | null>(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (!code) return null;
    return t(oauthErrorKey(code));
  });

  // Only offer a provider the server can actually complete: a button that fails after
  // the redirect is worse than no button.
  useEffect(() => {
    let live = true;
    void api<{ providers: string[] }>('/auth/providers')
      .then((result) => {
        if (live) setProviders(result.providers);
      })
      .catch(() => {
        if (live) setProviders([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setNeedsActivation(false);
    setResendMessage(null);
    setBusy(true);
    try {
      await api('/auth/local/signin', { method: 'POST', body: { user: { email, password } } });
      writeLastAuth('local');
      await refresh();
      navigate('/');
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 430) {
        // The password was accepted; only the second factor is outstanding.
        writeLastAuth('local');
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

  /** The name a person reads for the method they used last. */
  const methodName = (method: AuthMethod): string =>
    method === 'local'
      ? t('auth.signIn.methodPassword')
      : method === 'google'
        ? 'Google'
        : 'GitHub';

  return (
    <main className="auth">
      <div className="auth__card stack">
        <div>
          <h1 className="display-lg">{t('auth.signIn.title')}</h1>
          <p className="body muted">{t('auth.signIn.lede')}</p>
        </div>

        {lastAuth ? (
          <p className="fine-print auth__last-used">
            <span>{t('auth.signIn.lastUsed')}</span>
            {lastAuth === 'google' ? <GoogleMark size={14} /> : null}
            {lastAuth === 'github' ? <GitHubMark size={14} /> : null}
            <strong>{methodName(lastAuth)}</strong>
          </p>
        ) : null}

        {providerError ? <Notice tone="bad">{providerError}</Notice> : null}
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

        {providers.length > 0 ? (
          <div className="stack">
            <div className="or-rule">
              <span>{t('auth.signIn.or')}</span>
            </div>
            {providers.map((provider) => (
              <a
                key={provider}
                className="btn btn--secondary"
                href={`/api/auth/${provider}/start?device=${deviceId()}`}
              >
                {provider === 'google' ? <GoogleMark /> : null}
                {provider === 'github' ? <GitHubMark /> : null}
                <span>
                  {PROVIDER_KEYS[provider]
                    ? t(PROVIDER_KEYS[provider])
                    : t('auth.signIn.providerOther', { provider })}
                </span>
              </a>
            ))}
          </div>
        ) : null}

        <p className="fine-print">
          {t('auth.signIn.noAccount')}{' '}
          <a
            className="link"
            href="/console/signup"
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
    </main>
  );
}
