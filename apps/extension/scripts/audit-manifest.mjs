/**
 * The manifest is the privacy policy in machine form.
 *
 * Two stores will read it, and a reviewer will compare it against what the
 * listing claims. The extension asks for storage, an alarm clock, notifications
 * and — on Chrome only — an offscreen document. Anything else is a bug, and a
 * quiet one: a `tabs` or `<all_urls>` permission turns a seeder into something
 * that can read pages, which is exactly what this product promises it cannot do.
 *
 * Run after both builds: `npm run audit`.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ALLOWED = {
  chrome: ['alarms', 'notifications', 'offscreen', 'storage', 'unlimitedStorage'],
  firefox: ['alarms', 'notifications', 'storage', 'unlimitedStorage'],
};

const HOSTS = ['https://console.tilawah.cc/*', 'https://tilawah.cc/*'];

const TARGETS = [
  { name: 'chrome', path: '.output/chrome-mv3/manifest.json' },
  { name: 'firefox', path: '.output/firefox-mv2/manifest.json' },
];

const failures = [];

// `version_name` in wxt.config.ts is written by hand, so a bump can leave the
// built package claiming the old version — a store would reject the upload.
const packageVersion = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')).version;

const sorted = (list) => [...list].sort();

for (const target of TARGETS) {
  const file = join(process.cwd(), target.path);
  if (!existsSync(file)) {
    failures.push(`${target.name}: ${target.path} is missing — run npm run build${target.name === 'firefox' ? ':firefox' : ''}`);
    continue;
  }

  const manifest = JSON.parse(readFileSync(file, 'utf8'));

  if (manifest.version !== packageVersion) {
    failures.push(
      `${target.name}: manifest version ${manifest.version} != package.json ${packageVersion} — update version_name in wxt.config.ts`,
    );
  }

  // MV3 keeps host permissions in `host_permissions`; MV2 puts match patterns in
  // `permissions` beside the API names. The audit reads both shapes as one list,
  // or the Firefox build would fail on a permission it does not actually add.
  const rawPermissions = manifest.permissions ?? [];
  const permissions = sorted(rawPermissions.filter((p) => !p.includes('://')));
  const hosts = sorted([...(manifest.host_permissions ?? []), ...rawPermissions.filter((p) => p.includes('://'))]);
  const allowed = sorted(ALLOWED[target.name]);
  if (permissions.join(',') !== allowed.join(',')) {
    const extra = permissions.filter((p) => !allowed.includes(p));
    const missing = allowed.filter((p) => !permissions.includes(p));
    failures.push(
      `${target.name}: permissions are [${permissions.join(', ')}]` +
        (extra.length ? ` — not allowed: ${extra.join(', ')}` : '') +
        (missing.length ? ` — missing: ${missing.join(', ')}` : ''),
    );
  }

  if (hosts.join(',') !== sorted(HOSTS).join(',')) {
    failures.push(`${target.name}: host permissions are [${hosts.join(', ')}], expected [${HOSTS.join(', ')}]`);
  }

  if (manifest.content_scripts) {
    failures.push(`${target.name}: content_scripts present — the extension must never inject into pages`);
  }

  for (const key of ['tabs', 'history', 'webRequest', 'cookies', 'scripting']) {
    if ((manifest.permissions ?? []).includes(key)) failures.push(`${target.name}: forbidden API permission "${key}"`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`audit-manifest: ${failure}`);
  process.exit(1);
}

console.log('audit-manifest: chrome and firefox permissions match the allow-list');
