import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { useSession } from '../lib/session';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Notice } from '../components/Chip';

/**
 * The acceptance link for an ownership transfer. The mailed token is the
 * credential, and the API starts a fresh session for the new Owner on success.
 */
export function OwnerTransfer({ token: fromPath }: { token: string | null }): ReactElement {
  const { refresh } = useSession();
  const { t } = useI18n();
  const [state, setState] = useState<'working' | 'ok' | 'failed'>('working');
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    const token = fromPath ?? new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setState('failed');
      setMessage(t('ownerTransfer.noToken'));
      return;
    }

    void (async () => {
      try {
        const result = await api<{ message: string; owner: { name: string; email: string } }>(
          '/auth/owner-transfer/confirm',
          { method: 'POST', body: { token } },
        );
        await refresh();
        setName(result.owner.name);
        setState('ok');
      } catch (caught) {
        setState('failed');
        setMessage(caught instanceof Error ? caught.message : t('ownerTransfer.failed'));
      }
    })();
  }, [refresh, fromPath, t]);

  return (
    <div className="auth">
      <div className="auth__card stack">
        <h1 className="display-lg">
          {state === 'ok'
            ? t('ownerTransfer.ok')
            : state === 'failed'
              ? t('ownerTransfer.failedTitle')
              : t('ownerTransfer.working')}
        </h1>

        {state === 'ok' ? (
          <>
            <Notice tone="ok">
              {name ? `${name} — ${t('ownerTransfer.okBody')}` : t('ownerTransfer.okBody')}
            </Notice>
            <Button onClick={() => navigate('/')}>{t('ownerTransfer.dashboard')}</Button>
          </>
        ) : null}

        {state === 'failed' ? (
          <>
            <Notice tone="bad">{message}</Notice>
            <p className="body muted">{t('ownerTransfer.hint')}</p>
            <Button onClick={() => navigate('/signin')}>{t('common.signin')}</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
