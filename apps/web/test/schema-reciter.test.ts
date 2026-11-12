import assert from 'node:assert/strict';
import { test } from 'node:test';

import { combinedGraph, reciterGraph } from '../src/utils/schema.ts';

/**
 * What a reciter page says to a crawler.
 *
 * The page itself is a name and a hundred and fourteen links. This graph is the
 * only place that says "these are recordings by this person", which is the thing
 * missing from a site with twenty-two indexed pages and no impressions.
 */

const rows = [
  { name: 'الفاتحة', url: 'https://tilawah.cc/reciters/x/1', note: '7 آية · الجزء 1 · الصفحة 1' },
  { name: 'المائدة', url: 'https://tilawah.cc/reciters/x/5', note: '120 آية · الجزء 6 · الصفحة 106' },
];

test('the reciter page graph names the person and the collection', () => {
  const graph = reciterGraph({
    site: 'https://tilawah.cc',
    url: 'https://tilawah.cc/reciters/yassine-el-jazairi-warsh',
    name: 'ياسين الجزائري',
    alternateName: 'Yassine El Jazairi Warsh',
    riwaya: 'Warsh',
    surahs: rows,
  }) as {
    '@context': string;
    '@graph': Array<Record<string, any>>;
  };

  assert.equal(graph['@context'], 'https://schema.org');
  const types = graph['@graph'].map((node) => node['@type']);
  assert.deepEqual(types, ['Person', 'CollectionPage']);

  const [person, page] = graph['@graph'];
  assert.equal(person.name, 'ياسين الجزائري');
  assert.equal(person.alternateName, 'Yassine El Jazairi Warsh');
  assert.equal(person['@id'], 'https://tilawah.cc/reciters/yassine-el-jazairi-warsh#reciter');
  assert.equal(person.knowsLanguage, 'ar');

  assert.equal(page.url, 'https://tilawah.cc/reciters/yassine-el-jazairi-warsh');
  assert.equal(page.about['@id'], person['@id']);
  assert.equal(page.mainEntity['@type'], 'ItemList');
  assert.equal(page.mainEntity.numberOfItems, 2);
});

test('the list is contiguous from one, and carries the surah facts the page cannot', () => {
  // Google drops a trail that skips a position, silently; the visible page has
  // no room for verse counts, so the list item is where they are stated.
  const graph = reciterGraph({
    site: 'https://tilawah.cc',
    url: 'https://tilawah.cc/reciters/x',
    name: 'x',
    alternateName: 'x',
    riwaya: 'Hafs',
    surahs: rows,
  }) as { '@graph': Array<Record<string, any>> };

  const list = graph['@graph'][1].mainEntity;
  assert.deepEqual(
    list.itemListElement.map((item: Record<string, any>) => item.position),
    [1, 2],
  );
  assert.equal(list.itemListElement[1].name, 'المائدة');
  assert.equal(list.itemListElement[1].url, 'https://tilawah.cc/reciters/x/5');
  assert.equal(list.itemListElement[1].description, '120 آية · الجزء 6 · الصفحة 106');
});

test('the graph survives JSON without holes', () => {
  const graph = reciterGraph({
    site: 'https://tilawah.cc/',
    url: 'https://tilawah.cc/reciters/x',
    name: 'x',
    alternateName: 'x',
    riwaya: 'Hafs',
    surahs: [],
  });
  assert.deepEqual(JSON.parse(JSON.stringify(graph)), graph);
});

test('two graphs on one page become one document with one context', () => {
  // One script per page, so the breadcrumb and the reciter share a graph instead
  // of each carrying its own '@context'.
  const merged = combinedGraph(
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] },
    {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Person', '@id': 'x#reciter' },
        { '@type': 'CollectionPage', '@id': 'x' },
      ],
    },
  ) as { '@context': string; '@graph': Array<Record<string, any>> };

  assert.equal(merged['@context'], 'https://schema.org');
  assert.deepEqual(
    merged['@graph'].map((node) => node['@type']),
    ['BreadcrumbList', 'Person', 'CollectionPage'],
  );
  assert.equal(
    JSON.stringify(merged).match(/"@context"/g)?.length,
    1,
    'a second @context inside the graph is invalid JSON-LD',
  );
});
