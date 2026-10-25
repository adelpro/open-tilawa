import type { ReactElement } from 'react';
import { useI18n } from '../lib/i18n';
import { LegalPage } from '../components/LegalPage';

export function Privacy(): ReactElement {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('privacy.title')}
      version={t('privacy.version')}
      sections={[
        { heading: t('privacy.collect.heading'), body: t('privacy.collect.body') },
        { heading: t('privacy.use.heading'), body: t('privacy.use.body') },
        { heading: t('privacy.exceptions.heading'), body: t('privacy.exceptions.body') },
        { heading: t('privacy.storage.heading'), body: t('privacy.storage.body') },
        { heading: t('privacy.rights.heading'), body: t('privacy.rights.body') },
        { heading: t('privacy.contact.heading'), body: t('privacy.contact.body') },
      ]}
    />
  );
}
