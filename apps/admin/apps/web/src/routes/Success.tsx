import type { ReactElement } from 'react';
import { navigate } from '../lib/router';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';

/** The end of a flow that has nothing left to ask for. */
export function Success({ title, body }: { title: string; body: string }): ReactElement {
  const { t } = useI18n();
  return (
    <div className="auth">
      <div className="auth__card stack">
        <h1 className="display-lg">{title}</h1>
        <p className="body muted">{body}</p>
        <Button onClick={() => navigate('/')}>{t('success.continue')}</Button>
      </div>
    </div>
  );
}
