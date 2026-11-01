/**
 * The structured data the prerendered pages carry.
 *
 * Google reads three things a plain meta description cannot say: that this is a
 * site (WebSite), that the site is a free application (WebApplication), and where
 * a reciter page sits in the hierarchy (BreadcrumbList). The copy is the page's
 * own copy — the same names the document shows — so the markup cannot describe a
 * different product than the one a visitor lands on.
 *
 * Kept out of `scripts/prerender.mjs` so the graph can be tested without fetching
 * the catalogue: the build imports these functions, the test reads their output.
 */

export type Locale = 'ar' | 'en';

export type BreadcrumbItem = {
  /** The words the page shows for this step. */
  name: string;
  /** Absolute URL, built by the router's `toUrl` on the caller's side. */
  url: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

/**
 * `WebSite` + `Organization` + `WebApplication`, one graph.
 *
 * `offers.price` is a string on purpose: schema.org's price is a number or a
 * string, and Google's examples use the string form. `priceCurrency` has to be
 * present even at zero, or the offer is invalid.
 */
export function websiteGraph(input: {
  site: string;
  name: string;
  alternateName: string;
}): Record<string, unknown> {
  const siteUrl = `${input.site.replace(/\/$/, '')}/`;
  const organization = {
    '@type': 'Organization',
    '@id': `${siteUrl}#organization`,
    name: 'Tilawah',
    alternateName: 'تلاوة',
    url: siteUrl,
    logo: `${siteUrl}icons/icon-512.png`,
    // `sameAs` is identity, not attribution: the project's own repository. The
    // Itqan catalogue the recordings come from is a different organisation and
    // stays in the About copy, where it is a fact rather than a claim to be the
    // same entity.
    sameAs: ['https://github.com/adelpro/open-tilawa'],
  };

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}#website`,
        url: siteUrl,
        name: input.name,
        alternateName: input.alternateName,
        inLanguage: ['ar', 'en'],
        publisher: { '@id': `${siteUrl}#organization` },
      },
      organization,
      {
        '@type': 'WebApplication',
        '@id': `${siteUrl}#app`,
        name: input.name,
        url: siteUrl,
        applicationCategory: 'MultimediaApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires JavaScript and WebRTC',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        inLanguage: ['ar', 'en'],
        publisher: { '@id': `${siteUrl}#organization` },
      },
    ],
  };
}

/**
 * `BreadcrumbList` for a page that has a place in the hierarchy.
 *
 * Positions are 1-based and contiguous: Google drops a trail that starts at 2 or
 * skips a number, and the failure is silent. The caller passes the trail from the
 * root down, in the language of the page.
 */
export function breadcrumbTrail(items: BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * `FAQPage` for the questions the About page answers in words.
 *
 * The same items feed the visible `<dl>` and this markup, so a crawler and a
 * visitor cannot be told different answers. Google may not show FAQ rich
 * results for every site any more; the markup is still the clearest statement
 * of what the page answers, and it is what an assistant reads.
 */
export function faqPage(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}
