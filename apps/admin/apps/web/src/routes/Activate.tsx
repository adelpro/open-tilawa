import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Notice } from '../components/Chip';

/**
 * The activation link lands here with `?token=`.
 *
 * It redeems once, on mount, and then says what happened in words — an activation
 * screen that silently redirects leaves the user unsure whether the link worked or
 * merely expired.
 */
export function Activate({ token: fromPath }: { token: string | null }): ReactElement {
  const { refresh } = useSession();
  const { t } = useI18n();
  const [state, setState] = useState<'working' | 'ok' | 'failed'>('working');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = fromPath ?? new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('failed');
      setMessage(t('activate.noToken'));
      return;
    }

    void (async () => {
      try {
        await api('/auth/local/activate', { method: 'POST', body: { token } });
        await refresh();
        setState('ok');
      } catch (caught) {
        setState('failed');
        setMessage(caught instanceof Error ? caught.message : t('activate.failed'));
      }
    })();
  }, [refresh, fromPath, t]);

  return (
    <main className="auth">
      <div className="auth__card stack">
        <h1 className="display-lg">
          {state === 'ok'
            ? t('activate.ok')
            : state === 'failed'
              ? t('activate.failedTitle')
              : t('activate.working')}
        </h1>

        {state === 'ok' ? (
          <>
            <Notice tone="ok">{t('activate.okBody')}</Notice>
            <Button onClick={() => navigate('/')}>{t('activate.console')}</Button>
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
    </main>
  );
}
