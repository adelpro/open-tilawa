import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Notice } from '../components/Chip';

/**
 * The email-change link lands here with the token in the path.
 *
 * It redeems once, on mount, and then states the new address. The API revokes
 * the old sessions and starts a fresh one for this device, so the shell refreshes
 * into the new address rather than leaving a stale one on screen.
 */
export function EmailChange({ token: fromPath }: { token: string | null }): ReactElement {
  const { refresh } = useSession();
  const { t } = useI18n();
  const [state, setState] = useState<'working' | 'ok' | 'failed'>('working');
  const [message, setMessage] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const token = fromPath ?? new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('failed');
      setMessage(t('activate.noToken'));
      return;
    }

    void (async () => {
      try {
        const result = await api<{ message: string; email: string }>(
          '/auth/local/confirm-email-change',
          { method: 'POST', body: { token } },
        );
        await refresh();
        setEmail(result.email);
        setState('ok');
      } catch (caught) {
        setState('failed');
        setMessage(caught instanceof Error ? caught.message : t('activate.failed'));
      }
    })();
  }, [refresh, fromPath, t]);

  return (
    <div className="auth">
      <div className="auth__card stack">
        <h1 className="display-lg">
          {state === 'ok'
            ? t('account.email.title')
            : state === 'failed'
              ? t('activate.failedTitle')
              : t('activate.working')}
        </h1>

        {state === 'ok' ? (
          <>
            <Notice tone="ok">{email ?? t('account.email.sent')}</Notice>
            <Button onClick={() => navigate('/')}>{t('activate.dashboard')}</Button>
          </>
        ) : null}

        {state === 'failed' ? (
          <>
            <Notice tone="bad">{message}</Notice>
            <p className="body muted">{t('activate.hint')}</p>
            <Button onClick={() => navigate('/signin')}>{t('common.signin')}</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
