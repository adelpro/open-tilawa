import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Where the vendored gates live, and whether the interpreters they need exist.
 *
 * There is no filesystem search here, and that is the point. Upstream's
 * `resolve-paths.mjs` hunts through `~/.agents/skills`, `~/.claude/skills`, the
 * cwd and a recorded `paths.json`; a hosted service has none of those, and a
 * search that silently finds a *different* copy of a gate is a correctness
 * problem, not a convenience. The vendor directory is passed in by the caller
 * (or read from `USLUB_VENDOR_DIR`), and a missing script is a named error.
 *
 * `process.cwd()` is never consulted — that is an explicit exit criterion of P3,
 * and it is also what makes the same call behave identically from the API
 * container, the MCP container and a test.
 */
export const GATE_TOOLS = {
  'avoid-ai-writing': { key: 'gate4', script: join('avoid-ai-writing', 'check-style.js') },
  'remove-ai-marks': { key: 'gate5', script: join('remove-ai-marks', 'inspect_text.py') },
} as const;

export type GateId = keyof typeof GATE_TOOLS;

export interface GateToolPath {
  id: GateId;
  path: string;
}

export interface EngineTools {
  vendorDir: string;
  node: string;
  python: string | null;
  pythonProblem: string | null;
  gate4: GateToolPath | null;
  gate5: GateToolPath | null;
  missing: GateId[];
}

export interface ResolveEngineToolsOptions {
  /** Directory containing `gates/` and `voice-default/`. Required — never guessed. */
  vendorDir?: string;
  node?: string;
  /** Set to null to force the probe, or to a path to bypass it (tests, containers). */
  python?: string | null;
  pythonCandidates?: string[];
}

export function resolveVendorDir(explicit?: string): string {
  const dir = explicit ?? process.env.USLUB_VENDOR_DIR;
  if (!dir) {
    throw new Error(
      'the vendor directory is not configured: pass vendorDir, or set USLUB_VENDOR_DIR (in the containers it is /app/vendor)',
    );
  }
  return dir;
}

const firstOnPath = (names: string[]): string | null => {
  for (const name of names) {
    const finder = process.platform === 'win32' ? 'where' : 'which';
    const result = spawnSync(finder, [name], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      const hit = result.stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)[0];
      if (hit) return hit;
    }
  }
  return null;
};

/**
 * Resolve a Python that actually runs.
 *
 * Upstream's note still applies: resolving a name is not the same as being able
 * to execute it (the Windows Store stub is on PATH and exits non-zero), so the
 * candidate is probed. `python3` is tried first because that is the name that
 * exists in this deployment's containers, and the plan's contract is stated in
 * terms of `python3`.
 */
export function probePython(candidates: string[] = ['python3', 'python', 'py']): {
  path: string | null;
  problem: string | null;
} {
  const candidate = firstOnPath(candidates);
  if (!candidate) return { path: null, problem: 'python not found on PATH' };

  const result = spawnSync(candidate, ['--version'], { encoding: 'utf8' });
  if (result.status !== 0) {
    return {
      path: null,
      problem: `${candidate} does not run — install Python 3, or run the gate with skipMarks`,
    };
  }
  return { path: candidate, problem: null };
}

export function resolveEngineTools(options: ResolveEngineToolsOptions = {}): EngineTools {
  const vendorDir = resolveVendorDir(options.vendorDir);
  const gatesDir = join(vendorDir, 'gates');
  const missing: GateId[] = [];

  const resolveTool = (id: GateId): GateToolPath | null => {
    const path = join(gatesDir, GATE_TOOLS[id].script);
    if (!existsSync(path)) {
      missing.push(id);
      return null;
    }
    return { id, path };
  };

  const gate4 = resolveTool('avoid-ai-writing');
  const gate5 = resolveTool('remove-ai-marks');

  let python = options.python === undefined ? null : options.python;
  let pythonProblem: string | null = null;
  if (!python) {
    const probed = probePython(options.pythonCandidates);
    python = probed.path;
    pythonProblem = probed.problem;
  }

  return {
    vendorDir,
    node: options.node ?? process.execPath,
    python,
    pythonProblem,
    gate4,
    gate5,
    missing,
  };
}

/**
 * Read the recorded versions and hashes of the vendored gates.
 * `doctor` compares them against what is on disk, which is what catches a
 * hand-edited gate or a partially applied update.
 */
export interface VendorRecord {
  id: string;
  upstream: string;
  version?: string;
  files: Record<string, string>;
}

export interface VendorVersionFile {
  recordedAt?: string;
  records?: VendorRecord[];
}

export function readVendorVersionFile(vendorDir: string): VendorVersionFile | null {
  const file = join(vendorDir, 'gates', 'VERSION');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as VendorVersionFile;
  } catch {
    return null;
  }
}

export function loadBundledVoiceProfile(vendorDir: string): {
  dir: string;
  manifest: unknown;
  houseStyle: unknown;
  voiceCard: string | null;
  skillMd: string | null;
} {
  const dir = join(vendorDir, 'voice-default');
  const manifestPath = join(dir, 'writing-profile.json');
  const houseStylePath = join(dir, 'house-style.json');
  const voiceCardPath = join(dir, 'voice-card.md');
  const skillPath = join(dir, 'SKILL.md');

  const fs = { readFileSync } as typeof import('node:fs');
  if (!existsSync(manifestPath)) {
    throw new Error(`the bundled voice profile is missing: ${manifestPath}`);
  }

  return {
    dir,
    manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as unknown,
    houseStyle: existsSync(houseStylePath)
      ? (JSON.parse(fs.readFileSync(houseStylePath, 'utf8')) as unknown)
      : null,
    voiceCard: existsSync(voiceCardPath)
      ? (fs.readFileSync(voiceCardPath, 'utf8') as string)
      : null,
    // The bundled profile ships a card but no SKILL.md, so this is normally null;
    // reading it when present keeps the loader honest if that ever changes.
    skillMd: existsSync(skillPath) ? (fs.readFileSync(skillPath, 'utf8') as string) : null,
  };
}
