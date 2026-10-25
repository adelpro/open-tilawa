import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Icon } from '../components/icons';
import { EmailField, PasswordField } from '../components/fields';
import { Notice } from '../components/Chip';

/**
 * Request a reset link, and redeem it when the link brings a token back.
 *
 * The request step says the same thing for every address — "if that address is
 * registered" — because the API deliberately cannot tell the difference, and a
 * screen that guessed would undo that.
 */
export function ResetPassword({ token: fromPath }: { token: string | null }): ReactElement {
  const { t } = useI18n();
  const token = fromPath ?? new URLSearchParams(window.location.search).get('token');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const requestLink = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api('/reset-password/send-email', { method: 'POST', body: { email } });
      setDone(t('reset.sent'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reset.sendFailed'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setMismatch(t('signup.mismatch'));
      return;
    }
    setMismatch(null);
    setBusy(true);
    try {
      await api('/reset-password/validate', { method: 'POST', body: { token, password } });
      navigate('/signin');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('reset.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth__card stack">
        <h1 className="display-lg">{token ? t('reset.titleSet') : t('reset.titleRequest')}</h1>

        {error ? <Notice tone="bad">{error}</Notice> : null}
        {done ? <Notice tone="ok">{done}</Notice> : null}

        {token ? (
          <form className="stack" onSubmit={(event) => void reset(event)}>
            <PasswordField
              label={t('reset.newPassword')}
              hint={t('reset.hint')}
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
              {busy ? t('reset.saving') : t('reset.submit')}
            </Button>
          </form>
        ) : (
          <form className="stack" onSubmit={(event) => void requestLink(event)}>
            <EmailField label={t('common.email')} value={email} onChange={setEmail} required />
            <div className="cluster">
              <Button type="submit" icon={<Icon name="mail" />} disabled={busy}>
                {busy ? t('reset.sending') : t('reset.send')}
              </Button>
              <Button
                variant="tertiary"
                icon={<Icon name="key" />}
                onClick={() => navigate('/signin')}
              >
                {t('common.backToSignin')}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
