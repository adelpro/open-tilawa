import { useState, useEffect } from 'react';
import { navigate } from '../lib/router';
import type { FormEvent, ReactElement } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Notice } from '../components/Chip';
import { CodeField, EmailField, NameField, PasswordField } from '../components/fields';
import { Icon } from '../components/icons';

export function Setup(): ReactElement {
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // A setup link (/setup?token=...) pre-fills the token field, then the token
  // is stripped from the URL so it does not linger in history or referrer.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      setToken(urlToken);
      const clean = window.location.pathname;
      window.history.replaceState({}, '', clean);
    }
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    // Checked client-side before the API call: the server has one password field,
    // so a mismatch is a local problem and should not become a request.
    if (confirm !== password) {
      setMismatch(t('signup.mismatch'));
      return;
    }
    setMismatch(null);
    setBusy(true);
    try {
      await api('/setup', {
        method: 'POST',
        body: { token, name, email, password },
      });
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('setup.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="auth">
        <div className="auth__card stack">
          <h1 className="display-lg">{t('setup.doneTitle')}</h1>
          <Notice tone="ok">{t('setup.doneBody')}</Notice>
          <a href="/signin" className="button button--primary">
            {t('auth.signIn.submit')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <div className="auth__card stack">
        <div>
          <h1 className="display-lg">{t('setup.title')}</h1>
          <p className="body muted">{t('setup.lede')}</p>
        </div>

        {error ? <Notice tone="bad">{error}</Notice> : null}

        <form className="stack" onSubmit={(event) => void submit(event)}>
          <CodeField
            label={t('setup.token')}
            hint={t('setup.tokenHint')}
            value={token}
            onChange={setToken}
            required
            disabled={busy}
            name="setup-token"
            inputMode="text"
            autoComplete="off"
            pattern=".*"
            maxLength={100}
          />

          <NameField
            label={t('common.name')}
            value={name}
            onChange={setName}
            required
            disabled={busy}
          />

          <EmailField
            label={t('common.email')}
            value={email}
            onChange={setEmail}
            required
            disabled={busy}
          />

          <PasswordField
            label={t('common.password')}
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

          <Button type="submit" icon={<Icon name="lock" />} busy={busy}>
            {busy ? t('setup.saving') : t('setup.submit')}
          </Button>
        </form>

        <p className="fine-print">
          {t('setup.haveOne')}{' '}
          <a
            href="/dashboard/signin"
            onClick={(event) => {
              event.preventDefault();
              navigate('/signin');
            }}
          >
            {t('setup.signin')}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
