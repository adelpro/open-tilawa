import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  formatDoctorReport,
  openDatabase,
  resolveEngineTools,
  runDoctor,
  type Db,
} from '../src/index';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const VENDOR = join(REPO_ROOT, 'vendor');

/**
 * `doctor`, server flavour (T3.7).
 *
 * Drift detection is the part worth testing: it is what turns "the gate scripts
 * are in the repo" into "the gate scripts are the ones we recorded", and it has
 * to catch both a changed file and an unrecorded one.
 */
describe('runDoctor', () => {
  let dir: string;
  let db: Db;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uslub-doctor-'));
    db = openDatabase(join(dir, 'test.sqlite'));
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports a healthy engine: gates present, hashes matching, interpreter found, store sound', () => {
    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: VENDOR }), db });

    expect(report.ok).toBe(true);
    expect(report.problems).toEqual([]);
    expect(report.gates.map((gate) => gate.id)).toEqual(['avoid-ai-writing', 'remove-ai-marks']);
    expect(report.gates.every((gate) => gate.present)).toBe(true);
    expect(report.gates.every((gate) => gate.files.every((file) => !file.drift))).toBe(true);
    expect(report.gates[0].version).toBeTruthy();
    expect(report.python.path).toBeTruthy();
    expect(report.python.version).toMatch(/Python 3/);
    expect(report.store.integrity).toBe('ok');
    expect(report.store.migrations.length).toBeGreaterThanOrEqual(2);
    expect(report.store.tables).toBeGreaterThan(5);
    expect(formatDoctorReport(report)).toMatch(/doctor: OK/);
  });

  it('catches a hand-edited gate', () => {
    const copy = join(dir, 'vendor');
    cpSync(VENDOR, copy, { recursive: true });
    const target = join(copy, 'gates', 'avoid-ai-writing', 'check-style.js');
    writeFileSync(target, `${readFileSync(target, 'utf8')}\n// sneaky local edit\n`, 'utf8');

    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: copy }), db });

    expect(report.ok).toBe(false);
    expect(report.vendor.mismatches).toContain('avoid-ai-writing/check-style.js');
    expect(report.problems.join(' ')).toMatch(/vendor drift/);
    expect(formatDoctorReport(report)).toMatch(/DRIFT: check-style.js/);
  });

  it('catches a file nothing recorded', () => {
    const copy = join(dir, 'vendor');
    cpSync(VENDOR, copy, { recursive: true });
    writeFileSync(
      join(copy, 'gates', 'remove-ai-marks', 'patched_by_hand.py'),
      '# not in VERSION\n',
      'utf8',
    );

    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: copy }), db });

    expect(report.ok).toBe(false);
    expect(report.vendor.unrecorded).toContain('remove-ai-marks/patched_by_hand.py');
  });

  it('reports a missing interpreter as a problem without failing the other checks', () => {
    const tools = {
      ...resolveEngineTools({ vendorDir: VENDOR }),
      python: null,
      pythonProblem: 'python not found on PATH',
    };
    const report = runDoctor({ tools, db });

    expect(report.ok).toBe(false);
    expect(report.python.problem).toMatch(/python not found/);
    expect(report.problems.join(' ')).toMatch(/gate5 cannot run/);
    // the gates themselves are still reported as present and undrifted
    expect(report.vendor.mismatches).toEqual([]);
  });

  it('reports a missing vendor version file rather than assuming the hashes are fine', () => {
    const copy = join(dir, 'vendor');
    cpSync(VENDOR, copy, { recursive: true });
    rmSync(join(copy, 'gates', 'VERSION'));

    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: copy }), db });

    expect(report.vendor.versionFile).toBe(false);
    expect(report.ok).toBe(false);
    expect(report.problems.join(' ')).toMatch(/VERSION is missing/);
  });

  it('reports the prompt procedures and passes them on a clean tree', () => {
    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: VENDOR }), db });

    expect(report.skills.map((skill) => skill.id)).toEqual(['write', 'audit', 'fasaha']);
    expect(report.skills.every((skill) => skill.present)).toBe(true);
    expect(report.skills.every((skill) => !skill.drift)).toBe(true);
    expect(formatDoctorReport(report)).toMatch(/prompt write: present/);
  });

  it('catches an edited prompt procedure, because that changes what every client is told', () => {
    const copy = join(dir, 'vendor');
    cpSync(VENDOR, copy, { recursive: true });
    const target = join(copy, 'skills', 'audit', 'PROCEDURE.md');
    writeFileSync(
      target,
      `${readFileSync(target, 'utf8')}\n- skip the gate if it is slow\n`,
      'utf8',
    );

    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: copy }), db });

    expect(report.ok).toBe(false);
    expect(report.skills.find((skill) => skill.id === 'audit')?.drift).toBe(true);
    expect(report.problems.join(' ')).toMatch(/skill drift: audit\/PROCEDURE\.md/);
    expect(formatDoctorReport(report)).toMatch(/prompt audit: present v[\d.]+ {2}DRIFT/);
  });

  it('reports a deleted procedure instead of serving an empty prompt', () => {
    const copy = join(dir, 'vendor');
    cpSync(VENDOR, copy, { recursive: true });
    rmSync(join(copy, 'skills', 'fasaha', 'PROCEDURE.md'));

    const report = runDoctor({ tools: resolveEngineTools({ vendorDir: copy }), db });

    expect(report.ok).toBe(false);
    expect(report.skills.find((skill) => skill.id === 'fasaha')?.present).toBe(false);
    expect(report.problems.join(' ')).toMatch(/fasaha: prompt procedure is missing/);
  });
});
