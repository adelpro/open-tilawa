import type { ReactElement } from 'react';
import { useI18n } from '../lib/i18n';
import { LegalPage } from '../components/LegalPage';

export function About(): ReactElement {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('about.title')}
      version={t('about.version')}
      sections={[
        { heading: t('about.what.heading'), body: t('about.what.body') },
        { heading: t('about.who.heading'), body: t('about.who.body') },
        { heading: t('about.contact.heading'), body: t('about.contact.body') },
      ]}
    />
  );
}
