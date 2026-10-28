import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { EmailField, NameField, PasswordField } from '../components/fields';
import { Notice } from '../components/Chip';

/**
 * Sign up. The account exists but cannot sign in until the emailed link is
 * opened — so the screen says exactly that, and offers the resend.
 */
export function SignUp(): ReactElement {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    // Checked here rather than typed twice into the API: the server has no second field to
    // disagree with, and a request that can only fail locally should not be sent.
    if (confirm !== password) {
      setMismatch(t('signup.mismatch'));
      return;
    }
    setMismatch(null);
    setBusy(true);
    try {
      await api('/auth/local/signup', {
        method: 'POST',
        body: { user: { name, email, password } },
      });
      setSent(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('signup.failed'));
    } finally {
      setBusy(false);
    }
  };

  const resend = async (): Promise<void> => {
    setError(null);
    try {
      await api('/auth/local/resend-activation', { method: 'POST', body: { email } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('signup.resendFailed'));
    }
  };

  if (sent) {
    return (
      <main className="auth">
        <div className="auth__card stack">
          <h1 className="display-lg">{t('signup.sentTitle')}</h1>
          <Notice>{t('signup.sentBody', { email })}</Notice>
          {error ? <Notice tone="bad">{error}</Notice> : null}
          <div className="cluster">
            <Button onClick={() => void resend()}>{t('signup.resend')}</Button>
            <Button variant="tertiary" onClick={() => navigate('/signin')}>
              {t('common.backToSignin')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="auth">
      <div className="auth__card stack">
        <div>
          <h1 className="display-lg">{t('signup.title')}</h1>
          <p className="body muted">{t('signup.lede')}</p>
        </div>

        {error ? <Notice tone="bad">{error}</Notice> : null}

        <form className="stack" onSubmit={(event) => void submit(event)}>
          <NameField label={t('common.name')} value={name} onChange={setName} required />
          <EmailField label={t('common.email')} value={email} onChange={setEmail} required />
          <PasswordField
            label={t('common.password')}
            hint={t('signup.passwordHint')}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            required
            minLength={8}
            showStrength
          />

          <PasswordField
            label={t('signup.confirmPassword')}
            hint={t('signup.confirmHint')}
            value={confirm}
            onChange={(next) => {
              setConfirm(next);
              if (mismatch && next === password) setMismatch(null);
            }}
            autoComplete="new-password"
            required
          />
          {mismatch ? <Notice tone="bad">{mismatch}</Notice> : null}

          <Button type="submit" busy={busy}>
            {t('signup.submit')}
          </Button>
        </form>

        <p className="fine-print">
          {t('signup.haveOne')}{' '}
          <a
            href="/dashboard/signin"
            onClick={(event) => {
              event.preventDefault();
              navigate('/signin');
            }}
          >
            {t('signup.signin')}
          </a>
          .
        </p>
      </div>
    </main>
  );
}
