import type { ReactElement } from 'react';
import { useI18n } from '../lib/i18n';
import { LegalPage } from '../components/LegalPage';

export function Terms(): ReactElement {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('terms.title')}
      version={t('terms.version')}
      sections={[
        { heading: t('terms.service.heading'), body: t('terms.service.body') },
        { heading: t('terms.account.heading'), body: t('terms.account.body') },
        { heading: t('terms.use.heading'), body: t('terms.use.body') },
        { heading: t('terms.content.heading'), body: t('terms.content.body') },
        { heading: t('terms.data.heading'), body: t('terms.data.body') },
        { heading: t('terms.termination.heading'), body: t('terms.termination.body') },
        { heading: t('terms.changes.heading'), body: t('terms.changes.body') },
        { heading: t('terms.contact.heading'), body: t('terms.contact.body') },
      ]}
    />
  );
}
