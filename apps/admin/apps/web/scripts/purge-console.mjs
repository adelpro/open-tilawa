#!/usr/bin/env node
/**
 * Evict the console's shell from the edge after an `admin-web` deploy.
 *
 * The public site has `apps/web/scripts/purge-cache.mjs`, which reads the URLs the
 * build just wrote. The console cannot do that — it is one SPA shell served for
 * every screen — and the omission cost a release: Cloudflare held the previous
 * `index.html` (a Cache Rule on this host ignores the origin's `no-cache`), the new
 * build had already replaced the hashed bundle, and the cached shell pointed at a
 * script that now answered 404. The console was blank until the hour ran out.
 *
 * So this purges the shell, the prerendered pages and every screen the router can
 * paint — a stale screen URL breaks exactly like a stale root. The list is hand-kept
 * because the paths live in the source, not in build output; `test/purge-console
 * .test.mjs` fails when a `/console/...` literal appears that this file does not
 * name, which is what keeps it honest.
 *
 *   CF_API_TOKEN=... CF_ZONE_ID=... node scripts/purge-console.mjs
 *   node scripts/purge-console.mjs --dry-run        # print the URLs, call nothing
 *
 * Without a token the script prints what it would have evicted and exits 0: a
 * missing purge is a stale hour, not a failed deploy.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export const CONSOLE = (process.env.CONSOLE_URL ?? 'https://console.tilawah.cc').replace(/\/$/, '');

/** Every route the hand-rolled router can paint; the shell is served for each. */
export const SCREENS = [
  '/console',
  '/console/account',
  '/console/admin',
  '/console/profiles',
  '/console/reciters',
  '/console/seeders',
  '/console/settings',
  '/console/status',
  '/console/superadmin',
  '/console/tools',
  '/console/turns',
  '/console/usage',
];

/** The screens plus the prerendered marketing pages, from the same build data the page uses. */
export function consoleUrls(site = CONSOLE, here = HERE) {
  const data = JSON.parse(readFileSync(join(here, '..', 'seo', 'pages.json'), 'utf-8'));
  const pages = (data.pages ?? []).map((page) => page.path).filter(Boolean);
  return [...new Set(['/', ...pages, ...SCREENS])].map((path) => `${site}${path}`);
}

/** The API takes thirty files per call. */
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
  const urls = consoleUrls();
  const token = process.env.CF_API_TOKEN;
  const zone = process.env.CF_ZONE_ID;

  if (dryRun || !token || !zone) {
    const why = dryRun ? 'dry run' : !token ? 'CF_API_TOKEN is unset' : 'CF_ZONE_ID is unset';
    console.log(`${why}: would evict ${urls.length} console URLs`);
    for (const url of urls) console.log(`  ${url}`);
    return;
  }

  const result = await purge(urls, { token, zone });
  console.log(`evicted ${result.purged} console URLs`);
}

if (process.argv[1] && process.argv[1].endsWith('purge-console.mjs')) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
