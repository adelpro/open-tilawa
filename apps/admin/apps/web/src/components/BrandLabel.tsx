import type { ReactElement } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * The product label in a header: the short name and the running version.
 *
 * Deliberately wordmark-free — the Arabic mark belongs to the public artwork,
 * not the chrome. Answering "which build is this?" is the whole job.
 */
export function BrandLabel({ version }: { version: string | null }): ReactElement {
  const { t } = useI18n();
  return (
    <>
      {t('app.brandShort')}
      {version ? <span className="fine-print"> v{version}</span> : null}
    </>
  );
}
