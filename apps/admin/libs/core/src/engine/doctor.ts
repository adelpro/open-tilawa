import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { appliedMigrations, type Db } from '../store/db';
import {
  GATE_TOOLS,
  readVendorVersionFile,
  type EngineTools,
  type GateId,
  type VendorRecord,
} from './tools';
import { readSkillProcedures, type SkillId } from './skills';

/**
 * `doctor`, server flavour (T3.7).
 *
 * Upstream's doctor answered "is this install healthy?" — is the plugin wired
 * into these harnesses, is the manifest well-formed, can Python run. Hosted, the
 * only question that matters is "can this service do its job right now", so the
 * report covers the vendored gates (present, undrifted, recorded), the
 * interpreter, and the store.
 *
 * Drift is checked in both directions: a recorded file that changed, and a file
 * in a vendored directory that nothing recorded. The second one is how a
 * hand-copied script gets noticed.
 */
export interface GateReport {
  id: GateId;
  present: boolean;
  path: string | null;
  version: string | null;
  upstream: string | null;
  files: { name: string; sha256: string | null; expected: string | null; drift: boolean }[];
}

export interface DoctorReport {
  ok: boolean;
  gates: GateReport[];
  /** The vendored prompt procedures, checked exactly like the gates (T8.5). */
  skills: SkillReport[];
  python: { path: string | null; version: string | null; problem: string | null };
  vendor: { dir: string; versionFile: boolean; mismatches: string[]; unrecorded: string[] };
  store: { integrity: string; migrations: string[]; tables: number };
  problems: string[];
}

export interface SkillReport {
  id: SkillId;
  present: boolean;
  path: string | null;
  version: string | null;
  upstream: string | null;
  drift: boolean;
}

export interface RunDoctorInput {
  tools: EngineTools;
  db: Db;
  engineVersion?: string;
}

const sha256Of = (path: string): string | null => {
  try {
    return createHash('sha256').update(readFileSync(path)).digest('hex');
  } catch {
    return null;
  }
};

const pythonVersionOf = (tools: EngineTools): string | null => {
  if (!tools.python) return null;
  try {
    const result = spawnSync(tools.python, ['--version'], { encoding: 'utf8' });
    if (result.status !== 0) return null;
    return `${result.stdout ?? ''}${result.stderr ?? ''}`.trim() || null;
  } catch {
    return null;
  }
};

export function runDoctor(input: RunDoctorInput): DoctorReport {
  const { tools, db } = input;
  const problems: string[] = [];

  const versionFile = readVendorVersionFile(tools.vendorDir);
  const records: VendorRecord[] = versionFile?.records ?? [];
  const mismatches: string[] = [];
  const unrecorded: string[] = [];

  const gatesDir = join(tools.vendorDir, 'gates');

  const gates: GateReport[] = (Object.keys(GATE_TOOLS) as GateId[]).map((id) => {
    const record = records.find((entry) => entry.id === id);
    const toolPath =
      id === 'avoid-ai-writing' ? (tools.gate4?.path ?? null) : (tools.gate5?.path ?? null);
    const dirName = id;

    const files = Object.entries(record?.files ?? {}).map(([name, expected]) => {
      const path = join(gatesDir, dirName, name);
      const actual = existsSync(path) ? sha256Of(path) : null;
      const drift = actual !== expected;
      if (drift) mismatches.push(`${id}/${name}`);
      return { name, sha256: actual, expected, drift };
    });

    // Anything on disk in that directory that the record does not mention.
    // `__pycache__` is ignored deliberately: it is Python's, not ours, and the
    // gate is run with `-B` so it should not exist at all.
    const dir = join(gatesDir, dirName);
    if (existsSync(dir)) {
      for (const entry of readdirSync(dir)) {
        if (entry.endsWith('.pyc') || entry === '__pycache__') continue;
        if (!record?.files?.[entry] && entry !== 'README.md') unrecorded.push(`${id}/${entry}`);
      }
    }

    if (!toolPath) problems.push(`${id}: script not found in ${gatesDir}`);

    return {
      id,
      present: Boolean(toolPath),
      path: toolPath,
      version: record?.version ?? null,
      upstream: record?.upstream ?? null,
      files,
    };
  });

  if (mismatches.length > 0) problems.push(`vendor drift: ${mismatches.join(', ')}`);
  if (unrecorded.length > 0)
    problems.push(`unrecorded files in vendored gates: ${unrecorded.join(', ')}`);
  if (!versionFile) problems.push('vendor/gates/VERSION is missing or unreadable');

  // The prompt procedures, checked the same way: a changed line in one of these
  // changes what every client is told to do, which is exactly the kind of edit that
  // should not happen by accident.
  const procedures = readSkillProcedures(tools.vendorDir);
  const skills: SkillReport[] = procedures.map((procedure) => {
    if (!procedure.present) problems.push(`${procedure.id}: prompt procedure is missing`);
    else if (procedure.drift) problems.push(`skill drift: ${procedure.id}/PROCEDURE.md`);
    return {
      id: procedure.id,
      present: procedure.present,
      path: procedure.path,
      version: procedure.version,
      upstream: procedure.upstream,
      drift: procedure.drift,
    };
  });

  const python = {
    path: tools.python,
    version: pythonVersionOf(tools),
    problem: tools.python ? null : (tools.pythonProblem ?? 'python not found on PATH'),
  };
  if (!tools.python) problems.push(`gate5 cannot run: ${python.problem}`);

  let integrity = 'unknown';
  let tables = 0;
  let migrations: string[] = [];
  try {
    const row = db.prepare('PRAGMA integrity_check').get() as
      { integrity_check?: string } | undefined;
    integrity = row?.integrity_check ?? 'unknown';
    tables = (
      db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table'").get() as {
        n: number;
      }
    ).n;
    migrations = appliedMigrations(db);
  } catch (error) {
    integrity = `error: ${(error as Error).message}`;
  }
  if (integrity !== 'ok') problems.push(`database integrity check: ${integrity}`);

  return {
    ok: problems.length === 0,
    gates,
    skills,
    python,
    vendor: {
      dir: tools.vendorDir,
      versionFile: Boolean(versionFile),
      mismatches,
      unrecorded,
    },
    store: { integrity, migrations, tables },
    problems,
  };
}

export function formatDoctorReport(report: DoctorReport): string {
  const lines: string[] = [];
  for (const gate of report.gates) {
    const drift = gate.files.filter((file) => file.drift).map((file) => file.name);
    lines.push(
      `${gate.id}: ${gate.present ? 'present' : 'MISSING'}${gate.version ? ` v${gate.version}` : ''}` +
        `${drift.length ? `  DRIFT: ${drift.join(', ')}` : '  hashes match'}`,
    );
  }
  lines.push(
    `python: ${report.python.path ?? 'MISSING'}${report.python.version ? ` (${report.python.version})` : ''}` +
      `${report.python.problem ? `  ${report.python.problem}` : ''}`,
  );
  for (const skill of report.skills ?? []) {
    lines.push(
      `prompt ${skill.id}: ${skill.present ? 'present' : 'MISSING'}${skill.version ? ` v${skill.version}` : ''}` +
        `${skill.drift ? '  DRIFT' : skill.present ? '  hashes match' : ''}`,
    );
  }
  lines.push(
    `store: integrity=${report.store.integrity} migrations=${report.store.migrations.length} tables=${report.store.tables}`,
  );
  lines.push(report.ok ? 'doctor: OK' : `doctor: ${report.problems.length} problem(s)`);
  for (const problem of report.problems) lines.push(`  - ${problem}`);
  return lines.join('\n');
}
