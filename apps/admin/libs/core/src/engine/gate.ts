import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import type { EngineTools, GateId } from './tools';
import { toolchainGateFlags, type ToolchainStep } from './toolchain';

/**
 * The two gates, text-in (T3.4).
 *
 * Upstream took a *path* to a draft on the caller's disk. A hosted service has
 * no access to the caller's disk, so the draft arrives as text, is written to a
 * private temporary directory, and the directory is removed in `finally` — the
 * temporary copy is the one thing here that must never outlive the call.
 *
 * The exit contract is preserved exactly: **0 clean, 1 violation, 2 tool
 * error**, with the worst gate deciding the result. A missing script, a
 * missing interpreter or a timeout is always 2 — never a silent pass, because
 * "we could not check" reported as "clean" is the one failure mode that would
 * make the whole product untrustworthy.
 */
export type GateState = 'PASS' | 'FAIL' | 'ERROR';

export interface GateEntry {
  id: GateId;
  state: GateState;
  code: 0 | 1 | 2;
  summary: string;
  hits: string[];
  ms: number;
}

export interface GateResult {
  code: 0 | 1 | 2;
  ok: boolean;
  gates: GateEntry[];
  /** Present only for a failure before either gate ran (a bad request, not a verdict). */
  error?: string;
}

export interface RunGateInput {
  /** The draft itself. No file path is ever accepted from a caller. */
  text: string;
  /** The profile's house style; passed to gate4 as `--config <file>`. */
  houseStyle?: Record<string, unknown> | null;
  skipStyle?: boolean;
  skipMarks?: boolean;
  /** The profile's chain; a present chain overrides the skip flags below. */
  toolchain?: ToolchainStep[] | null;
  tools: EngineTools;
  /** Both gates get this long, measured per gate. */
  timeoutMs?: number;
  /** Where the scratch directory is created; defaults to the OS temp dir. */
  tmpRoot?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

/** 4MB: generous for a report, small enough that a runaway gate cannot exhaust memory. */
const MAX_BUFFER = 4 * 1024 * 1024;

const stateFor = (code: number): GateState => (code === 0 ? 'PASS' : code === 1 ? 'FAIL' : 'ERROR');

const normalise = (code: number | null | undefined): 0 | 1 | 2 =>
  code === 0 || code === 1 ? code : 2;

interface SpawnOutcome {
  code: 0 | 1 | 2;
  text: string;
  timedOut: boolean;
}

const spawnTool = (
  exe: string,
  args: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): SpawnOutcome => {
  let result;
  try {
    result = spawnSync(exe, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
      ...(env ? { env } : {}),
    });
  } catch (error) {
    return { code: 2, text: String((error as Error)?.message ?? error), timedOut: false };
  }

  const timedOut = (result.error as NodeJS.ErrnoException | undefined)?.code === 'ETIMEDOUT';
  if (timedOut) {
    return { code: 2, text: `timed out after ${Math.round(timeoutMs / 1000)}s`, timedOut: true };
  }

  return {
    code: normalise(result.status),
    text: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    timedOut: false,
  };
};

/** Ported verbatim from upstream gate.mjs: the report is the parser's contract. */
export const parseAvoidAiWriting = (text: string): { summary: string; hits: string[] } => {
  const lines = text.split(/\r?\n/);
  const summary = (lines.find((line) => /\d+\s+hard/.test(line)) ?? '').trim();
  const hits: string[] = [];
  for (const line of lines) {
    const match = /^\s*L\d+\s+(.+?)\s*$/.exec(line);
    if (match) hits.push(match[1]);
  }
  return { summary, hits };
};

export const parseRemoveAiMarks = (text: string): { summary: string; hits: string[] } => {
  const lines = text.split(/\r?\n/);
  const summary = (lines.find((line) => /^Suspicious:\s*\d+/.test(line.trim())) ?? '').trim();
  const hits = lines.filter((line) => /U\+[0-9A-Fa-f]{4}/.test(line)).map((line) => line.trim());
  return { summary, hits };
};

const entry = (
  id: GateId,
  code: 0 | 1 | 2,
  summary: string,
  hits: string[],
  ms: number,
): GateEntry => ({ id, state: stateFor(code), code, summary, hits, ms });

/**
 * Turn a gate's exit code and console output into a verdict.
 *
 * The distinction this adds over upstream: a gate that **crashes** exits 1, and
 * exit 1 means "a hard violation". A missing sibling file, a syntax error or a
 * broken interpreter therefore arrive as a violation that no one can act on —
 * and worse, as `FAIL` on a draft nobody checked. So exit 1 without a parseable
 * report is treated as a tool error, and the first line of the output is carried
 * into the summary so the cause is named.
 */
const interpret = (
  rawCode: 0 | 1 | 2,
  parsed: { summary: string; hits: string[] },
  raw: string,
  timedOut: boolean,
): { code: 0 | 1 | 2; summary: string } => {
  if (timedOut) return { code: 2, summary: raw.trim().split('\n')[0] };
  if (rawCode === 0) return { code: 0, summary: parsed.summary || 'clean' };
  if (rawCode === 1) {
    if (parsed.summary) return { code: 1, summary: parsed.summary };
    const firstLine =
      raw
        .trim()
        .split('\n')
        .find((line) => line.trim() !== '') ?? 'no output';
    return { code: 2, summary: `exited 1 without a report — ${firstLine.trim()}`.slice(0, 300) };
  }
  return { code: 2, summary: parsed.summary || `exit ${rawCode}` };
};

export function runGate(input: RunGateInput): GateResult {
  const { text, tools } = input;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chainFlags = toolchainGateFlags(input.toolchain ?? null);

  if (typeof text !== 'string') {
    return {
      code: 2,
      ok: false,
      gates: [],
      error: 'a draft (text) is required',
    };
  }

  let dir: string;
  try {
    dir = mkdtempSync(join(input.tmpRoot ?? tmpdir(), 'uslub-gate-'));
  } catch (error) {
    return {
      code: 2,
      ok: false,
      gates: [],
      error: `could not create a scratch directory: ${(error as Error).message}`,
    };
  }

  try {
    const draftPath = join(dir, 'draft.md');
    writeFileSync(draftPath, text, 'utf8');

    let configPath: string | null = null;
    if (input.houseStyle) {
      configPath = join(dir, 'house-style.json');
      writeFileSync(configPath, JSON.stringify(input.houseStyle), 'utf8');
    }

    const gates: GateEntry[] = [];

    // --- gate4: avoid-ai-writing (node) ---
    if (chainFlags.skipStyle || input.skipStyle) {
      gates.push(entry('avoid-ai-writing', 0, 'skipped', [], 0));
    } else if (!tools.gate4) {
      gates.push(entry('avoid-ai-writing', 2, 'avoid-ai-writing not found', [], 0));
    } else {
      const args = [tools.gate4.path, draftPath, ...(configPath ? ['--config', configPath] : [])];
      const started = Date.now();
      const result = spawnTool(tools.node, args, timeoutMs);
      const verdict = interpret(
        result.code,
        parseAvoidAiWriting(result.text),
        result.text,
        result.timedOut,
      );
      gates.push(
        entry(
          'avoid-ai-writing',
          verdict.code,
          verdict.summary,
          parseAvoidAiWriting(result.text).hits,
          Date.now() - started,
        ),
      );
    }

    // --- gate5: remove-ai-marks (python) ---
    if (chainFlags.skipMarks || input.skipMarks) {
      gates.push(entry('remove-ai-marks', 0, 'skipped', [], 0));
    } else if (!tools.python) {
      gates.push(
        entry('remove-ai-marks', 2, tools.pythonProblem ?? 'python not found on PATH', [], 0),
      );
    } else if (!tools.gate5) {
      gates.push(entry('remove-ai-marks', 2, 'remove-ai-marks not found', [], 0));
    } else {
      const started = Date.now();
      // `-B` and PYTHONDONTWRITEBYTECODE: `inspect_text.py` imports its two
      // siblings from its own directory, so Python would write a `__pycache__`
      // *into the vendored tree* — mutating the artefact whose hashes doctor
      // verifies, on every single call. A service must not edit its own gates.
      const result = spawnTool(tools.python, ['-B', tools.gate5.path, draftPath], timeoutMs, {
        ...process.env,
        PYTHONDONTWRITEBYTECODE: '1',
      });
      const parsed = parseRemoveAiMarks(String(result.text ?? ''));
      const verdict = interpret(result.code, parsed, result.text, result.timedOut);
      gates.push(
        entry('remove-ai-marks', verdict.code, verdict.summary, parsed.hits, Date.now() - started),
      );
    }

    const code = gates.reduce<0 | 1 | 2>(
      (worst, gate) => (gate.code > worst ? gate.code : worst),
      0,
    );
    return { code, ok: code === 0, gates };
  } finally {
    // The draft exists only for the duration of the call.
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Event-loop-safe twin of `runGate` (audit: sync subprocess block). The
 * doctor CLI and unit tests keep the sync copy; anything serving requests
 * (the MCP tool) must use this one so a gate run can never freeze the whole
 * process — `spawnSync` blocks the event loop for the child's entire runtime,
 * up to two gates a 10 s each.
 */
export async function runGateAsync(input: RunGateInput): Promise<GateResult> {
  const { text, tools } = input;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const chainFlags = toolchainGateFlags(input.toolchain ?? null);

  const badRequest = (error: string): GateResult => ({ code: 2, ok: false, gates: [], error });
  if (typeof text !== 'string') return badRequest('a draft (text) is required');

  let dir: string;
  try {
    dir = mkdtempSync(join(input.tmpRoot ?? tmpdir(), 'uslub-gate-'));
  } catch (error) {
    return badRequest(`could not create a scratch directory: ${(error as Error).message}`);
  }

  try {
    const draftPath = join(dir, 'draft.md');
    writeFileSync(draftPath, text, 'utf8');

    let configPath: string | null = null;
    if (input.houseStyle) {
      configPath = join(dir, 'house-style.json');
      writeFileSync(configPath, JSON.stringify(input.houseStyle), 'utf8');
    }

    const gates: GateEntry[] = [];

    // --- gate4: avoid-ai-writing (node) ---
    if (chainFlags.skipStyle || input.skipStyle) {
      gates.push(entry('avoid-ai-writing', 0, 'skipped', [], 0));
    } else if (!tools.gate4) {
      gates.push(entry('avoid-ai-writing', 2, 'avoid-ai-writing not found', [], 0));
    } else {
      const args = [tools.gate4.path, draftPath, ...(configPath ? ['--config', configPath] : [])];
      const started = Date.now();
      const runner = spawnToolAsync(tools.node, args, timeoutMs);
      const result = await runner;
      const parsed = parseAvoidAiWriting(String(result.text ?? ''));
      const verdict = interpret(result.code, parsed, result.text, result.timedOut);
      gates.push(
        entry('avoid-ai-writing', verdict.code, verdict.summary, parsed.hits, Date.now() - started),
      );
    }

    // --- gate5: remove-ai-marks (python) ---
    if (chainFlags.skipMarks || input.skipMarks) {
      gates.push(entry('remove-ai-marks', 0, 'skipped', [], 0));
    } else if (!tools.python) {
      gates.push(
        entry('remove-ai-marks', 2, tools.pythonProblem ?? 'python not found on PATH', [], 0),
      );
    } else if (!tools.gate5) {
      gates.push(entry('remove-ai-marks', 2, 'remove-ai-marks not found', [], 0));
    } else {
      const started = Date.now();
      const result = await spawnToolAsync(
        tools.python,
        ['-B', tools.gate5.path, draftPath],
        timeoutMs,
        {
          ...process.env,
          PYTHONDONTWRITEBYTECODE: '1',
        },
      );
      const parsed = parseRemoveAiMarks(String(result.text ?? ''));
      const verdict = interpret(result.code, parsed, result.text, result.timedOut);
      gates.push(
        entry('remove-ai-marks', verdict.code, verdict.summary, parsed.hits, Date.now() - started),
      );
    }

    const code = gates.reduce<0 | 1 | 2>(
      (worst, gate) => (gate.code > worst ? gate.code : worst),
      0,
    );
    return { code, ok: code === 0, gates };
  } finally {
    // The draft exists only for the duration of the call.
    rmSync(dir, { recursive: true, force: true });
  }
}

const execFileAsync = promisify(execFile) as (
  file: string,
  args: readonly string[],
  options: { encoding: 'utf8'; timeout: number; maxBuffer: number; env?: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

const spawnToolAsync = async (
  exe: string,
  args: string[],
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<SpawnOutcome> => {
  try {
    const { stdout } = await execFileAsync(exe, args, {
      encoding: 'utf8',
      timeout: timeoutMs,
      maxBuffer: MAX_BUFFER,
      ...(env ? { env } : {}),
    });
    return { code: 0, text: stdout ?? '', timedOut: false };
  } catch (error) {
    const err = error as
      | (NodeJS.ErrnoException & { stdout?: string; signal?: NodeJS.Signals; killed?: boolean })
      | undefined;
    if (err && (err.killed === true || err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM')) {
      return { code: 2, text: String(err.stdout ?? ''), timedOut: true };
    }
    const exit = typeof err?.code === 'number' ? err.code : null;
    if (exit !== null) {
      return { code: normalise(exit), text: String(err?.stdout ?? ''), timedOut: false };
    }
    return { code: 2, text: String(err?.message ?? error), timedOut: false };
  }
};

/** Human-readable report, mirroring upstream's formatReport. */
export function formatGateReport(result: GateResult): string {
  const lines = result.gates.map((gate) => {
    const label =
      gate.id === 'avoid-ai-writing' ? 'gate4 avoid-ai-writing' : 'gate5 remove-ai-marks ';
    const detail = [gate.summary, gate.hits.join('; ')].filter(Boolean).join('  |  ');
    return `${label} : ${gate.state}  ${detail}`;
  });
  if (lines.length === 0) lines.push(result.error ?? 'write-gate: BLOCKED');
  lines.push(
    result.code === 0 ? 'write-gate: CLEAN' : `write-gate: BLOCKED (worst exit ${result.code})`,
  );
  return lines.join('\n');
}
