import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * The seeder's version lives in two files, and a release has to move both.
 *
 * `/health` reports `package.json` (the running code), while the image carries
 * `LABEL version` (what a registry and `docker inspect` show). A bump that edits
 * one and not the other makes the fleet compare two different numbers — the same
 * class of drift that once left the console answering an old `/health` version.
 * The lockfile is checked too: `npm version` writes all three, a hand edit does
 * not.
 */
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf-8');

test('the image label, the package and its lockfile agree', () => {
  const pkg = JSON.parse(read('../package.json'));
  const lock = JSON.parse(read('../package-lock.json'));
  const dockerfile = read('../Dockerfile');
  const label = dockerfile.match(/^LABEL version="([^"]+)"/m)?.[1];

  assert.equal(label, pkg.version, 'Dockerfile LABEL version disagrees with package.json');
  assert.equal(lock.version, pkg.version, 'package-lock.json disagrees with package.json');
  assert.equal(lock.packages[''].version, pkg.version, 'the lockfile root disagrees');
});

test('the version is a seeder version, not the repository coordinate', () => {
  // The repository carries its own release number; the seeder ships on its own
  // line. Copying the root number here happened once and made every node report
  // a version no seeder tag had.
  const pkg = JSON.parse(read('../package.json'));
  const root = JSON.parse(read('../../../package.json'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.notEqual(pkg.version, root.version);
});
