import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatGateReport,
  parseAvoidAiWriting,
  parseRemoveAiMarks,
  resolveEngineTools,
  runGate,
  type EngineTools,
} from '../src/index';

/**
 * The gate contract, ported from `writing-flow/tests/gate.test.mjs` and asserted
 * with the same expectations its own suite uses, so "the same verdicts" is a
 * checked claim rather than a hope. The parity script additionally replays these
 * fixtures through the local plugin when its checkout is present.
 */
const REPO_ROOT = join(__dirname, '..', '..', '..');
const VENDOR = join(REPO_ROOT, 'vendor');
const FIXTURES = join(__dirname, 'fixtures');

const readFixture = (name: string): string => readFileSync(join(FIXTURES, `${name}.md`), 'utf8');
const houseStyle = JSON.parse(
  readFileSync(join(VENDOR, 'voice-default', 'house-style.json'), 'utf8'),
);

const realTools = (): EngineTools => resolveEngineTools({ vendorDir: VENDOR });

describe('runGate (text in)', () => {
  it('passes a clean draft, with both gates actually running', () => {
    const result = runGate({ text: readFixture('clean'), houseStyle, tools: realTools() });

    expect(result.code).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.gates).toHaveLength(2);
    expect(result.gates.map((gate) => gate.id)).toEqual(['avoid-ai-writing', 'remove-ai-marks']);
    expect(result.gates.every((gate) => gate.state === 'PASS')).toBe(true);
  });

  it('fails a bundled abbreviation outside parentheses and names the rule', () => {
    const result = runGate({
      text: readFixture('bad-latin-abbrev'),
      houseStyle,
      tools: realTools(),
    });

    expect(result.code).toBe(1);
    expect(result.ok).toBe(false);
    expect(result.gates.some((gate) => gate.hits.includes('latin-abbrev-outside-parens'))).toBe(
      true,
    );
  });

  it('reports a byte order mark as a codepoint, not a crash', () => {
    const result = runGate({ text: readFixture('bom'), houseStyle, tools: realTools() });

    expect(result.code).toBe(1);
    expect(result.gates.some((gate) => gate.hits.some((hit) => /U\+FEFF/.test(hit)))).toBe(true);
  });

  it('does not crash on an Arabic draft', () => {
    const result = runGate({ text: readFixture('arabic'), houseStyle, tools: realTools() });

    expect([0, 1]).toContain(result.code);
    expect(result.gates).toHaveLength(2);
  });

  it('treats a missing interpreter as a tool error naming the cause, never a pass', () => {
    const tools = { ...realTools(), python: null, pythonProblem: 'python not found on PATH' };
    const result = runGate({ text: readFixture('clean'), houseStyle, tools });

    expect(result.code).toBe(2);
    expect(result.ok).toBe(false);
    const marks = result.gates.find((gate) => gate.id === 'remove-ai-marks');
    expect(marks?.state).toBe('ERROR');
    expect(marks?.summary).toMatch(/python/i);
  });

  it('treats a missing vendored gate as a tool error, not a silent pass', () => {
    const empty = mkdtempSync(join(tmpdir(), 'uslub-no-gates-'));
    try {
      const result = runGate({
        text: readFixture('clean'),
        houseStyle,
        tools: resolveEngineTools({ vendorDir: empty }),
      });

      expect(result.code).toBe(2);
      expect(result.gates.map((gate) => gate.summary)).toEqual([
        'avoid-ai-writing not found',
        'remove-ai-marks not found',
      ]);
    } finally {
      rmSync(empty, { recursive: true, force: true });
    }
  });

  it('a deleted vendored file is code 2 even when the directory still looks right', () => {
    const copy = mkdtempSync(join(tmpdir(), 'uslub-partial-vendor-'));
    try {
      const gatesDir = join(copy, 'gates', 'avoid-ai-writing');
      const marksDir = join(copy, 'gates', 'remove-ai-marks');
      mkdirSync(gatesDir, { recursive: true });
      mkdirSync(marksDir, { recursive: true });
      // gate4 keeps its entry script but loses the sibling it requires
      writeFileSync(
        join(gatesDir, 'check-style.js'),
        readFileSync(join(VENDOR, 'gates', 'avoid-ai-writing', 'check-style.js')),
      );
      // gate5 is present
      for (const file of ['inspect_text.py', 'common.py', 'text_unicode.py']) {
        writeFileSync(
          join(marksDir, file),
          readFileSync(join(VENDOR, 'gates', 'remove-ai-marks', file)),
        );
      }

      const result = runGate({
        text: readFixture('clean'),
        houseStyle,
        tools: resolveEngineTools({ vendorDir: copy }),
      });

      // `markdown-prose.js` is required by `check-style.js`: node exits non-zero,
      // which must surface as ERROR. This is the "never silently skip" case.
      expect(result.code).toBe(2);
      expect(result.gates[0].state).toBe('ERROR');
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  it('kills a gate that exceeds the timeout and reports it as a tool error', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uslub-slow-gate-'));
    try {
      const slow = join(dir, 'slow.js');
      writeFileSync(slow, 'const t = Date.now(); while (Date.now() - t < 3000) {}\n', 'utf8');

      const tools: EngineTools = {
        ...realTools(),
        gate4: { id: 'avoid-ai-writing', path: slow },
        gate5: null,
        missing: ['remove-ai-marks'],
      };
      const result = runGate({ text: 'anything', tools, timeoutMs: 300 });

      expect(result.code).toBe(2);
      expect(result.gates[0].summary).toMatch(/timed out/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('normalises any exit code above 1 to 2', () => {
    const dir = mkdtempSync(join(tmpdir(), 'uslub-odd-exit-'));
    try {
      const odd = join(dir, 'odd.js');
      writeFileSync(odd, 'process.exit(7);\n', 'utf8');
      const tools: EngineTools = { ...realTools(), gate4: { id: 'avoid-ai-writing', path: odd } };

      const result = runGate({ text: 'anything', tools, skipMarks: true });

      expect(result.gates[0].code).toBe(2);
      expect(result.code).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips visibly: a skipped gate is PASS with the reason, not silence', () => {
    const tools: EngineTools = { ...realTools(), python: null, gate4: null, gate5: null };
    const result = runGate({ text: readFixture('clean'), skipStyle: true, skipMarks: true, tools });

    expect(result.code).toBe(0);
    expect(result.gates.map((gate) => gate.summary)).toEqual(['skipped', 'skipped']);
    expect(formatGateReport(result)).toMatch(/skipped/);
  });

  it('rejects a non-string draft before running anything', () => {
    const result = runGate({ text: undefined as unknown as string, tools: realTools() });
    expect(result.code).toBe(2);
    expect(result.error).toMatch(/a draft \(text\) is required/);
    expect(result.gates).toHaveLength(0);
  });

  it('removes its scratch directory, draft and house style included', () => {
    const tmpRoot = mkdtempSync(join(tmpdir(), 'uslub-gate-root-'));
    try {
      const result = runGate({
        text: readFixture('bad-latin-abbrev'),
        houseStyle,
        tools: realTools(),
        tmpRoot,
      });
      expect(result.code).toBe(1);
      // Nothing may survive the call: the draft was the caller's text.
      expect(readdirSync(tmpRoot)).toEqual([]);
    } finally {
      rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it('parses the upstream report shapes exactly', () => {
    expect(
      parseAvoidAiWriting('House: 1 hard, 0 advisory\n  L1  latin-abbrev-outside-parens\n'),
    ).toEqual({
      summary: 'House: 1 hard, 0 advisory',
      hits: ['latin-abbrev-outside-parens'],
    });
    expect(parseRemoveAiMarks('Suspicious: 1\nU+FEFF at line 1\n')).toEqual({
      summary: 'Suspicious: 1',
      hits: ['U+FEFF at line 1'],
    });
  });
});

describe('resolveEngineTools', () => {
  it('never guesses a vendor directory', () => {
    const saved = process.env.USLUB_VENDOR_DIR;
    delete process.env.USLUB_VENDOR_DIR;
    try {
      expect(() => resolveEngineTools()).toThrow(/vendor directory is not configured/);
    } finally {
      if (saved) process.env.USLUB_VENDOR_DIR = saved;
    }
  });

  it('finds both gates and an interpreter that runs', () => {
    const tools = realTools();
    expect(tools.gate4?.path).toBe(join(VENDOR, 'gates', 'avoid-ai-writing', 'check-style.js'));
    expect(tools.gate5?.path).toBe(join(VENDOR, 'gates', 'remove-ai-marks', 'inspect_text.py'));
    expect(tools.python).toBeTruthy();
    expect(tools.pythonProblem).toBeNull();
    expect(tools.missing).toEqual([]);
    expect(existsSync(tools.gate4?.path as string)).toBe(true);
  });
});
