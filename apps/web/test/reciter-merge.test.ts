import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  cleanTorrentName,
  idFromHash,
  mergeReciters,
  type CatalogueRow,
} from '../src/utils/reciter-merge.ts';
import { MagnetlinkSource, type Reciter } from '../src/types/index.ts';

const MAHER = '5e0becf35d91ea4602f04db90d74621a172aa396';
const GHAMDI = 'ff77deab793113dabf0a39d85fe6dbfdb107438a';
const BADR = 'https://itqan.example/badr';

function magnet(hash: string): string {
  return `magnet:?xt=urn:btih:${hash}&dn=x&tr=wss://tracker.example`;
}

const statics: Reciter[] = [
  {
    id: 1,
    name: 'سعد الغامدي',
    magnet: magnet(MAHER),
    source: MagnetlinkSource.MP3QURAN,
    complet: true,
  },
  {
    id: 11,
    name: 'بدر التركي',
    magnet: '',
    source: MagnetlinkSource.ITQAN,
    complet: false,
    itqanPlaylist: [{ surahId: 1, link: BADR }],
  },
];

const rows: CatalogueRow[] = [
  { name: 'Maher_Al-Muaiqly_(MP3_Quran)', infohash: MAHER, magnet: magnet(MAHER) },
  { name: 'Quran-MP3-Ghamdi', infohash: GHAMDI, magnet: magnet(GHAMDI) },
];

test('cleanTorrentName turns a folder name into something readable', () => {
  assert.equal(cleanTorrentName('Maher_Al-Muaiqly_(Update2)_(MP3_Quran)'), 'Maher Al Muaiqly');
  assert.equal(cleanTorrentName('Quran-Huzza-Al_Baloushi'), 'Quran Huzza Al Baloushi');
  assert.equal(
    cleanTorrentName('The Holy Quran MP3 recited by Mishary Rashid Al Afasy'),
    'Mishary Rashid Al Afasy',
  );
  assert.equal(cleanTorrentName('wadee'), 'wadee');
});

test('the Arabic table wins over a static name that contradicts the torrent', () => {
  const merged = mergeReciters(rows, statics);
  const maher = merged.find((r) => r.id === 1);
  // The static entry called this hash "سعد الغامدي"; the torrent is Maher's.
  assert.equal(maher?.name, 'ماهر المعيقلي');
  assert.equal(merged.find((r) => r.magnet.includes(GHAMDI))?.name, 'سعد الغامدي');
});

test('catalogue-only rows get a stable id above the static range', () => {
  const merged = mergeReciters(rows, statics);
  const ghamdi = merged.find((r) => r.magnet.includes(GHAMDI));
  assert.ok(ghamdi);
  assert.ok(ghamdi!.id >= 1_000_000);
  assert.equal(ghamdi!.id, idFromHash(GHAMDI));
});

test('an unknown hash falls back to the cleaned name', () => {
  const merged = mergeReciters(
    [{ name: 'Ahmed_Alajmi_(MP3_Quran)', infohash: 'aaaa', magnet: magnet('aaaa') }],
    statics,
  );
  assert.equal(merged[0].name, 'Ahmed Alajmi');
});

test('a reciter with an explicit Arabic name beats the table', () => {
  const merged = mergeReciters(
    [{ name: 'x', nameAr: 'اسم من الكتالوج', infohash: MAHER, magnet: magnet(MAHER) }],
    statics,
  );
  assert.equal(merged[0].name, 'اسم من الكتالوج');
});

test('HTTP-only reciters survive a successful catalogue fetch', () => {
  const merged = mergeReciters(rows, statics);
  assert.equal(merged.length, 3);
  assert.equal(merged.at(-1)?.name, 'بدر التركي');
  assert.equal(merged.at(-1)?.itqanPlaylist?.[0].link, BADR);
});

test('a reciter whose hash the catalogue no longer lists is dropped, not duplicated', () => {
  const stale: Reciter = {
    id: 14,
    name: 'وديع اليمني',
    magnet: magnet('e63e2267f739b5f8a14a05c8501df17856e33166'),
    source: MagnetlinkSource.MP3QURAN,
    complet: true,
  };
  const merged = mergeReciters(rows, [...statics, stale]);
  assert.equal(merged.length, 3);
  assert.ok(!merged.some((r) => r.id === 14));
});

test('duplicate rows are collapsed by infohash', () => {
  const merged = mergeReciters([...rows, rows[0]], statics);
  assert.equal(merged.filter((r) => r.magnet.includes(MAHER)).length, 1);
});
