import assert from 'node:assert/strict';
import { test } from 'node:test';

import { purge, urlsFromSitemap } from '../scripts/purge-cache.mjs';

/**
 * What a deploy has to evict.
 *
 * Cloudflare holds the pre-built pages for an hour, so a release can sit behind
 * the previous one until something says otherwise. The sitemap is the build's own
 * list of what it wrote — a second hand-kept list would drift the first time a
 * route is added.
 */

test('every loc in the sitemap is a URL to evict', () => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tilawah.cc/</loc></url>
  <url><loc>https://tilawah.cc/reciters</loc></url>
  <url><loc>https://tilawah.cc/reciters/ali-jaber</loc></url>
</urlset>`;

  assert.deepEqual(urlsFromSitemap(sitemap), [
    'https://tilawah.cc/',
    'https://tilawah.cc/reciters',
    'https://tilawah.cc/reciters/ali-jaber',
  ]);
});

test('a language twin is evicted too, or one language serves the old page', () => {
  const sitemap = `<urlset>
  <url><loc>https://tilawah.cc/reciters</loc></url>
  <url><loc>https://tilawah.cc/en/reciters</loc></url>
</urlset>`;

  assert.deepEqual(urlsFromSitemap(sitemap), [
    'https://tilawah.cc/reciters',
    'https://tilawah.cc/en/reciters',
  ]);
});

test('a sitemap with nothing in it evicts nothing', () => {
  assert.deepEqual(urlsFromSitemap('<urlset></urlset>'), []);
});

test('more than thirty URLs are evicted in batches, not silently truncated', async () => {
  // The API takes thirty files per call. A release can pass that, and a success
  // line that names the whole list while half of it stayed cached is worse than
  // an error.
  const urls = Array.from({ length: 31 }, (_, index) => `https://tilawah.cc/p/${index}`);
  const calls: number[] = [];
  const fetchImpl = async (_url: string, init: { body: string }) => {
    calls.push(JSON.parse(init.body).files.length);
    return { ok: true, status: 200, json: async () => ({ success: true }) };
  };

  const result = await purge(urls, { token: 't', zone: 'z', fetchImpl });

  assert.deepEqual(calls, [30, 1]);
  assert.deepEqual(result, { purged: 31 });
});
