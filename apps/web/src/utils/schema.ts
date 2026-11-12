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

export type ReciterSurah = {
  /** The surah's name in the page's own language. */
  name: string;
  /** Absolute URL of the listen page, built by the router on the caller's side. */
  url: string;
  /** Verses, juz and page, already worded in the page's language. */
  note: string;
};

/**
 * `Person` + `CollectionPage` for one reciter.
 *
 * The page a visitor sees is a name and a hundred and fourteen links; nothing on
 * it says "these are recordings, by this person". This graph says exactly that,
 * and each list item carries the verse count, juz and page the page has no room
 * for — the text Google needs to match a search against.
 *
 * No `AudioObject` per surah on purpose: a hundred and fourteen of them add tens
 * of kilobytes of JSON to every page for a type Google shows no rich result for.
 * The list is the claim; the files are one tap away.
 */
export function reciterGraph(input: {
  site: string;
  url: string;
  name: string;
  alternateName: string;
  riwaya: string;
  surahs: ReciterSurah[];
}): Record<string, unknown> {
  const siteUrl = `${input.site.replace(/\/$/, '')}/`;
  const personId = `${input.url}#reciter`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': personId,
        name: input.name,
        alternateName: input.alternateName,
        knowsLanguage: 'ar',
        description: `${input.riwaya}`,
        url: input.url,
      },
      {
        '@type': 'CollectionPage',
        '@id': input.url,
        url: input.url,
        name: input.name,
        inLanguage: 'ar',
        about: { '@id': personId },
        isPartOf: { '@id': `${siteUrl}#website` },
        mainEntity: {
          '@type': 'ItemList',
          numberOfItems: input.surahs.length,
          itemListElement: input.surahs.map((surah, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            name: surah.name,
            url: surah.url,
            description: surah.note,
          })),
        },
      },
    ],
  };
}

/**
 * Several graphs on one page, as one document.
 *
 * A page can need more than one claim — the breadcrumb and the reciter, say — and
 * a second `<script type="application/ld+json">` is a second document with its own
 * `@context`. Merging them into one `@graph` is what the specification expects, and
 * what keeps the page's structured data readable as a single thing.
 */
export function combinedGraph(...graphs: Record<string, unknown>[]): Record<string, unknown> {
  const nodes = graphs.flatMap((graph) => {
    const inner = graph['@graph'];
    if (Array.isArray(inner)) return inner as unknown[];
    const { '@context': _context, ...node } = graph;
    return [node];
  });
  return { '@context': 'https://schema.org', '@graph': nodes };
}
