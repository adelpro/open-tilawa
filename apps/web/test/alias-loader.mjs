import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `node:test` does not read tsconfig, so `@/…` and extensionless relative
 * imports (the two things every file in `src` uses) have to be resolved here.
 * Two candidates short of a bundler: the path itself, then the TypeScript and
 * directory-index forms Vite/tsc would find.
 */
const root = new URL('../src/', import.meta.url);

function isFile(url) {
  try {
    return statSync(fileURLToPath(url)).isFile();
  } catch {
    return false;
  }
}

function firstExisting(base) {
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    if (isFile(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  let base = null;

  if (specifier.startsWith('@/')) {
    base = new URL(specifier.slice(2), root).href;
  } else if (specifier.startsWith('.') && !/\.(m?[jt]sx?|json)$/.test(specifier)) {
    base = new URL(specifier, context.parentURL).href;
  }

  if (base) {
    const hit = firstExisting(base);
    if (hit) return { url: hit, shortCircuit: true };
  }

  return next(specifier, context);
}
