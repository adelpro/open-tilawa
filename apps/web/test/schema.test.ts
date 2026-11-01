import assert from 'node:assert/strict';
import { test } from 'node:test';

import { breadcrumbTrail, faqPage, websiteGraph } from '../src/utils/schema.ts';

test('the home graph names the site and the free application', () => {
  const graph = websiteGraph({
    site: 'https://tilawah.cc',
    name: 'تلاوة',
    alternateName: 'Tilawah',
  }) as {
    '@context': string;
    '@graph': Array<Record<string, any>>;
  };

  assert.equal(graph['@context'], 'https://schema.org');
  const types = graph['@graph'].map((node) => node['@type']);
  assert.deepEqual(types, ['WebSite', 'Organization', 'WebApplication']);

  const [website, organization, app] = graph['@graph'];
  assert.equal(website.url, 'https://tilawah.cc/');
  assert.deepEqual(website.inLanguage, ['ar', 'en']);
  assert.equal(website.publisher['@id'], 'https://tilawah.cc/#organization');
  assert.equal(organization.logo, 'https://tilawah.cc/icons/icon-512.png');
  assert.deepEqual(organization.sameAs, ['https://github.com/adelpro/open-tilawa']);

  assert.equal(app.applicationCategory, 'MultimediaApplication');
  assert.equal(app.isAccessibleForFree, true);
  assert.equal(app.offers.price, '0');
  assert.equal(app.offers.priceCurrency, 'USD');
  assert.equal(app.publisher['@id'], 'https://tilawah.cc/#organization');
});

test('the graph survives JSON without holes', () => {
  const graph = websiteGraph({
    site: 'https://tilawah.cc/',
    name: 'Tilawah',
    alternateName: 'تلاوة',
  });
  const parsed = JSON.parse(JSON.stringify(graph));
  assert.deepEqual(parsed, graph);
  // A trailing slash in SITE must not produce `//icons` or `//#website`.
  assert.ok(!JSON.stringify(graph).includes('.cc//'), 'double slash in the site URL');
});

test('the breadcrumb is contiguous and absolute', () => {
  const trail = breadcrumbTrail([
    { name: 'تلاوة', url: 'https://tilawah.cc/' },
    { name: 'القرّاء', url: 'https://tilawah.cc/reciters' },
    { name: 'ياسين الجزائري', url: 'https://tilawah.cc/reciters/yassine-el-jazairi-warsh' },
  ]) as { '@type': string; itemListElement: Array<Record<string, any>> };

  assert.equal(trail['@type'], 'BreadcrumbList');
  assert.deepEqual(
    trail.itemListElement.map((item) => item.position),
    [1, 2, 3],
  );
  assert.deepEqual(
    trail.itemListElement.map((item) => item.name),
    ['تلاوة', 'القرّاء', 'ياسين الجزائري'],
  );
  assert.equal(
    trail.itemListElement[2].item,
    'https://tilawah.cc/reciters/yassine-el-jazairi-warsh',
  );
});

test('the FAQ markup is the same questions the page answers', () => {
  const items = [
    { question: 'هل تلاوة مجانية؟', answer: 'نعم، بلا إعلانات ولا اشتراكات.' },
    { question: 'هل أحتاج إلى حساب؟', answer: 'لا، الحساب غير مطلوب للاستماع.' },
  ];
  const page = faqPage(items) as {
    '@type': string;
    mainEntity: Array<Record<string, any>>;
  };
  assert.equal(page['@type'], 'FAQPage');
  assert.equal(page.mainEntity.length, items.length);
  assert.deepEqual(
    page.mainEntity.map((entry) => entry.name),
    items.map((item) => item.question),
  );
  assert.deepEqual(
    page.mainEntity.map((entry) => entry.acceptedAnswer.text),
    items.map((item) => item.answer),
  );
  assert.ok(page.mainEntity.every((entry) => entry['@type'] === 'Question'));
  assert.ok(page.mainEntity.every((entry) => entry.acceptedAnswer['@type'] === 'Answer'));
});
