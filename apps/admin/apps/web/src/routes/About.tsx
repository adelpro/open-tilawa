import type { ReactElement } from 'react';
import { useI18n } from '../lib/i18n';
import { LegalPage } from '../components/LegalPage';

export function About(): ReactElement {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('about.title')}
      lede={t('about.lede')}
      sections={[
        { heading: t('about.idea.heading'), body: t('about.idea.body') },
        { heading: t('about.how.heading'), body: t('about.how.body') },
        { heading: t('about.name.heading'), body: t('about.name.body') },
        { heading: t('about.console.heading'), body: t('about.console.body') },
        { heading: t('about.who.heading'), body: t('about.who.body') },
        { heading: t('about.contact.heading'), body: t('about.contact.body') },
      ]}
    />
  );
}
