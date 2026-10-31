import type { ReactElement } from 'react';
import { useI18n } from '../lib/i18n';

/**
 * The product lockup in a header: the تلاوة wordmark, the short name and the
 * running version.
 *
 * The mark is a masked span, not an image with an alt: the name beside it is the
 * accessible label, and the artwork takes the surrounding ink so it stays legible
 * on the dark canvas. Answering "which build is this?" is still the whole job.
 */
export function BrandLabel({ version }: { version: string | null }): ReactElement {
  const { t } = useI18n();
  return (
    <>
      <span className="brand-mark" aria-hidden="true" />
      {t('app.brandShort')}
      {version ? <span className="fine-print"> v{version}</span> : null}
    </>
  );
}
