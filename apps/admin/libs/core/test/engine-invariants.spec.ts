import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Two P3 exit criteria that are easy to lose later, so they are asserted rather
 * than remembered.
 */
const ENGINE_DIR = join(__dirname, '..', 'src', 'engine');

/** Comment lines may *discuss* `process.cwd()`; code may not use it. */
const codeLines = (source: string): string[] =>
  source.split('\n').filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('*') && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
  });

describe('engine invariants', () => {
  const files = readdirSync(ENGINE_DIR).filter((name) => name.endsWith('.ts'));

  it('has engine sources to check', () => {
    expect(files.length).toBeGreaterThan(3);
  });

  it('never consults the working directory — the vendor path is passed in', () => {
    const offenders = files.filter((file) =>
      codeLines(readFileSync(join(ENGINE_DIR, file), 'utf8')).some((line) =>
        line.includes('process.cwd()'),
      ),
    );

    expect(offenders).toEqual([]);
  });

  it('never resolves a gate by searching the filesystem', () => {
    // The one search upstream does that must not come back: readdir over skill
    // roots, which can silently pick a different copy of a gate.
    const offenders = files.filter((file) =>
      codeLines(readFileSync(join(ENGINE_DIR, file), 'utf8')).some((line) =>
        /readdirSync\(\s*(root|roots|homedir)/.test(line),
      ),
    );

    expect(offenders).toEqual([]);
  });
});
