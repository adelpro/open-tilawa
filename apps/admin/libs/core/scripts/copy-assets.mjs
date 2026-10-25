#!/usr/bin/env node
/**
 * tsc does not copy .sql files, and the migration runner reads them from
 * __dirname at runtime. Copy them next to the compiled output, or a fresh
 * container starts with an empty database and a confusing error.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const from = join(here, '..', 'src', 'store', 'migrations');
const to = join(here, '..', 'dist', 'store', 'migrations');

if (!existsSync(from)) {
  console.error(`copy-assets: ${from} is missing`);
  process.exit(1);
}

mkdirSync(to, { recursive: true });
cpSync(from, to, { recursive: true });
console.log(`copy-assets: migrations -> ${to}`);
