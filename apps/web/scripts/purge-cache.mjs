#!/usr/bin/env node
/**
 * Evict the pre-built pages from the edge after a deploy.
 *
 * Cloudflare holds them for an hour once the Cache Rule exists (see docs or the
 * dashboard note in DEPLOYING), which is what makes the site open in under 300 ms
 * instead of asking this machine for every page. The same hour is why a release
 * would otherwise sit behind the previous one: this is the thing that says
 * "now".
 *
 * The list comes from `dist/purge-urls.txt`, which the build writes for exactly
 * this: every URL it wrote, English twins included. The sitemap is the fallback —
 * it is the same list minus the pages that canonicalise elsewhere, and those are
 * cached too.
 *
 *   CF_API_TOKEN=... CF_ZONE_ID=... node scripts/purge-cache.mjs
 *   node scripts/purge-cache.mjs --dry-run     # print the URLs, call nothing
 *
 * Without a token the script prints what it would have evicted and exits 0: a
 * missing purge is a stale hour, not a failed deploy.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every `<loc>` in a sitemap, in document order, as absolute URLs. */
export function urlsFromSitemap(xml) {
  const urls = [];
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) urls.push(match[1].trim());
  return urls;
}

/** The API takes thirty files per call; a release is closer to fifty URLs. */
export const PURGE_BATCH = 30;

export async function purge(urls, { token, zone, fetchImpl = fetch }) {
  if (urls.length === 0) return { skipped: 'nothing to purge' };
  let purged = 0;
  for (let start = 0; start < urls.length; start += PURGE_BATCH) {
    const files = urls.slice(start, start + PURGE_BATCH);
    const response = await fetchImpl(
      `https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ files }),
      },
    );
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) {
      const detail = body.errors ? JSON.stringify(body.errors) : `HTTP ${response.status}`;
      // Partial is not success: say how many landed, so the next run can be aimed.
      throw new Error(`purge failed after ${purged}/${urls.length}: ${detail}`);
    }
    purged += files.length;
  }
  return { purged };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dist = join(HERE, '..', 'dist');
  let xml;
  try {
    xml = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
  } catch {
    console.error(`no sitemap at ${dist}/sitemap.xml — run the build first`);
    process.exit(1);
  }

  // The build's own list first: it includes the English twins the sitemap omits.
  let urls;
  try {
    urls = readFileSync(join(dist, 'purge-urls.txt'), 'utf8')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    urls = urlsFromSitemap(xml);
  }
  const token = process.env.CF_API_TOKEN;
  const zone = process.env.CF_ZONE_ID;

  if (dryRun || !token || !zone) {
    const why = dryRun ? 'dry run' : !token ? 'CF_API_TOKEN is unset' : 'CF_ZONE_ID is unset';
    console.log(`${why}: would evict ${urls.length} pages`);
    for (const url of urls) console.log(`  ${url}`);
    return;
  }

  const result = await purge(urls, { token, zone });
  console.log(`evicted ${result.purged} pages`);
}

if (process.argv[1] && process.argv[1].endsWith('purge-cache.mjs')) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
