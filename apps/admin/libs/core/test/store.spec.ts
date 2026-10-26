import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  SessionsRepository,
  TrustedDevicesRepository,
  UsersRepository,
  appliedMigrations,
  openDatabase,
  type Db,
} from '../src/index';

describe('store', () => {
  let dir: string;
  let db: Db;
  let users: UsersRepository;
  let sessions: SessionsRepository;
  let devices: TrustedDevicesRepository;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'tilawa-admin-store-'));
    db = openDatabase(join(dir, 'test.sqlite'));
    users = new UsersRepository(db);
    sessions = new SessionsRepository(db);
    devices = new TrustedDevicesRepository(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('applies every migration once, and is idempotent', () => {
    // Asserted as containment rather than an exact list: the point is that each
    // migration is applied and *not* re-applied, and a hardcoded list turns every
    // new migration into a test edit that says nothing.
    expect(appliedMigrations(db)).toEqual(
      expect.arrayContaining(['001_init.sql', '002_auth.sql', '003_voice.sql']),
    );
    expect(appliedMigrations(db)).toEqual(appliedMigrations(db)); // re-read, not re-run
  });

  it('survives two processes migrating the same fresh database at once', () => {
    // The deployment starts `api` and `mcp` together against one file. Before the
    // applied-set check moved inside the write lock, both read "003 pending", the
    // first committed, and the second hit "duplicate column name" and refused to
    // boot — which is exactly what happened on the first P4 deploy.
    const raceDir = mkdtempSync(join(tmpdir(), 'tilawa-admin-migrate-race-'));
    const racePath = join(raceDir, 'race.sqlite');
    const core = join(__dirname, '..', 'dist', 'index.js');
    const child = `const c = require(${JSON.stringify(core)}); c.openDatabase(process.argv[1]).close();`;

    try {
      const runs = [0, 1, 2, 3].map(() =>
        spawnSync(process.execPath, ['-e', child, racePath], { encoding: 'utf8' }),
      );

      for (const run of runs) {
        expect(run.status).toBe(0);
        expect(run.stderr).not.toMatch(/duplicate column name/);
      }

      // and the column exists exactly once, with the migration recorded
      const check = openDatabase(racePath);
      const columns = check
        .prepare('PRAGMA table_info(profiles)')
        .all()
        .map((row) => (row as { name: string }).name);
      expect(columns.filter((name) => name === 'skill_md')).toHaveLength(1);
      expect(appliedMigrations(check)).toEqual(
        expect.arrayContaining(['001_init.sql', '002_auth.sql', '003_voice.sql']),
      );
      check.close();
    } finally {
      rmSync(raceDir, { recursive: true, force: true });
    }
  });

  it('creates a user with role user by default, and hides the hash unless asked', () => {
    const created = users.create({ name: 'Adel', email: 'Adel@Example.com', passwordHash: 'x' });
    expect(created.role).toBe('user');
    expect(created.isActivated).toBe(false);
    expect(created).not.toHaveProperty('password');

    // email is case-insensitive, like the ported schema's `lowercase: true`
    expect(users.getByEmail('adel@example.com')?.id).toBe(created.id);

    // the hash is available only through an explicit request, as upstream's `.select('+password')`
    const withPassword = users.getByEmail('adel@example.com', true);
    expect(withPassword?.password).toBe('x');
    expect(users.getPasswordHash(created.id)).toBe('x');
  });

  it('rejects a duplicate email rather than creating a second account', () => {
    users.create({ name: 'Adel', email: 'adel@example.com' });
    expect(() => users.create({ name: 'Adel Again', email: 'ADEL@example.com' })).toThrow();
  });

  it('resolves a live session by token, and not after signout', () => {
    const user = users.create({ name: 'Adel', email: 'adel@example.com' });
    const token = SessionsRepository.newToken();
    sessions.upsertByFingerprint({
      userId: user.id,
      token,
      fingerprint: { label: 'laptop' },
      ttlMs: 60_000,
    });

    expect(sessions.findLiveByToken(token)?.user_id).toBe(user.id);

    sessions.deleteByToken(token);
    expect(sessions.findLiveByToken(token)).toBeNull();
  });

  it('treats a session as dead once expired', () => {
    const user = users.create({ name: 'Adel', email: 'adel@example.com' });
    const token = SessionsRepository.newToken();
    sessions.upsertByFingerprint({ userId: user.id, token, fingerprint: null, ttlMs: -1_000 });
    expect(sessions.findLiveByToken(token)).toBeNull();
  });

  it('keeps one session per device: a second sign-in replaces that device row', () => {
    const user = users.create({ name: 'Adel', email: 'adel@example.com' });
    const first = SessionsRepository.newToken();
    const second = SessionsRepository.newToken();
    sessions.upsertByFingerprint({
      userId: user.id,
      token: first,
      fingerprint: { label: 'laptop' },
      ttlMs: 60_000,
    });
    sessions.upsertByFingerprint({
      userId: user.id,
      token: second,
      fingerprint: { label: 'laptop' },
      ttlMs: 60_000,
    });

    expect(sessions.listByUser(user.id)).toHaveLength(1);
    expect(sessions.findLiveByToken(first)).toBeNull();
    expect(sessions.findLiveByToken(second)?.user_id).toBe(user.id);
  });

  it('trusts a device only after it is added, and expires it', () => {
    const user = users.create({ name: 'Adel', email: 'adel@example.com' });
    const fingerprint = { label: 'laptop', ua: 'x' };

    expect(devices.isTrusted(user.id, fingerprint)).toBe(false);
    devices.add(user.id, fingerprint);
    expect(devices.isTrusted(user.id, fingerprint)).toBe(true);
    // key order in the fingerprint object must not matter
    expect(devices.isTrusted(user.id, { ua: 'x', label: 'laptop' })).toBe(true);

    devices.add(user.id, fingerprint, -1);
    expect(devices.isTrusted(user.id, fingerprint)).toBe(false);
  });

  it('cascades: deleting a user removes their sessions and devices', () => {
    const user = users.create({ name: 'Adel', email: 'adel@example.com' });
    const token = SessionsRepository.newToken();
    sessions.upsertByFingerprint({
      userId: user.id,
      token,
      fingerprint: { label: 'laptop' },
      ttlMs: 60_000,
    });
    devices.add(user.id, { label: 'laptop' });

    users.delete(user.id);

    expect(sessions.findLiveByToken(token)).toBeNull();
    expect(devices.listByUser(user.id)).toHaveLength(0);
  });

  it('scopes every read and write to its owner', () => {
    const adel = users.create({ name: 'Adel', email: 'adel@example.com' });
    const other = users.create({ name: 'Other', email: 'other@example.com' });
    const fingerprint = { label: 'shared-device' };
    const token = SessionsRepository.newToken();

    sessions.upsertByFingerprint({ userId: adel.id, token, fingerprint, ttlMs: 60_000 });
    devices.add(adel.id, fingerprint);

    // A different user sees none of it.
    expect(sessions.listByUser(other.id)).toHaveLength(0);
    expect(devices.listByUser(other.id)).toHaveLength(0);
    expect(sessions.getByFingerprint(other.id, fingerprint)).toBeNull();
    expect(devices.isTrusted(other.id, fingerprint)).toBe(false);

    // And cannot remove it by presenting the same fingerprint.
    expect(sessions.deleteByFingerprint(other.id, fingerprint)).toBe(false);
    expect(devices.remove(other.id, fingerprint)).toBe(false);
    expect(sessions.listByUser(adel.id)).toHaveLength(1);
    expect(devices.isTrusted(adel.id, fingerprint)).toBe(true);

    // The token itself still resolves — to its owner.
    expect(sessions.findLiveByToken(token)?.user_id).toBe(adel.id);
  });
});
