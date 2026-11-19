/**
 * About: why this exists, who to write to, and the two documents that say what
 * it does with your machine. The store links appear only once a listing exists —
 * a placeholder that 404s teaches people not to click.
 */

import { BRAND, hasStoreLinks } from '@/constants/brand';
import type { Copy } from '@/lib/i18n';
import { SUGGEST_BODY, SUGGEST_SUBJECT } from '@/lib/legal';
import { aboutStoreHref } from '@/lib/store-link';
import { ArrowIcon, PlusIcon } from '@/components/icons';
import { LegalBlock } from '@/components/legal-block';

export function AboutView({ copy, lang, version }: { copy: Copy; lang: 'ar' | 'en'; version: string }) {
  const suggestHref = `mailto:${BRAND.contact}?subject=${encodeURIComponent(
    SUGGEST_SUBJECT[lang],
  )}&body=${encodeURIComponent(SUGGEST_BODY[lang])}`;

  return (
    <section id="about" className="screen" aria-labelledby="about-title">
      <h2 id="about-title">{copy.navAbout}</h2>
      <p>{copy.aboutP1}</p>
      <p>{copy.aboutP2}</p>

      <div className="links">
        <a href={`mailto:${BRAND.contact}`}>
          <ArrowIcon /> {copy.contactUs}
        </a>
        <a href={suggestHref}>
          <PlusIcon /> {copy.suggestReciter}
        </a>
        <a href={BRAND.trackerStats} target="_blank" rel="noreferrer">
          <ArrowIcon /> {copy.trackerLink}
        </a>
        {hasStoreLinks() ? (
          <a href={aboutStoreHref(import.meta.env.MANIFEST_VERSION)} target="_blank" rel="noreferrer">
            <ArrowIcon /> {copy.storeLink}
          </a>
        ) : null}
      </div>

      <LegalBlock privacy={copy.privacyTitle} terms={copy.termsTitle} />

      <p className="meta" style={{ marginBlockStart: '1.5rem' }}>
        <bdi dir="ltr">{version}</bdi>
      </p>
    </section>
  );
}
