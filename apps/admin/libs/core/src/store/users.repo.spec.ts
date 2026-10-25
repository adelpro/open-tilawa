import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db, migrate, openDatabase } from './db';
import { InstanceNotClaimedError, UsersRepository } from './users.repo';

/**
 * The ownership primitives: one Owner per instance, settable only by the
 * dedicated methods, and a claim gate on creation that cannot be raced past.
 */
describe('ownership', () => {
  let dir: string;
  let db: Db;
  let users: UsersRepository;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'owner-'));
    db = openDatabase(join(dir, 'test.db'));
    migrate(db);
    users = new UsersRepository(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('starts with no owner', () => {
    expect(users.hasOwner()).toBe(false);
    expect(users.getOwner()).toBeNull();
  });

  it('setOwner promotes a user and leaves exactly one owner', () => {
    const a = users.create({ name: 'A', email: 'a@example.com', role: 'super_admin' });
    const b = users.create({ name: 'B', email: 'b@example.com', role: 'super_admin' });

    users.setOwner(a.id);
    expect(users.getOwner()?.id).toBe(a.id);

    // The hard guarantee: a second owner is impossible at the database.
    expect(() => db.prepare('UPDATE users SET is_owner = 1 WHERE id = ?').run(b.id)).toThrow(
      /UNIQUE/i,
    );
    expect(users.getOwner()?.id).toBe(a.id);
  });

  it('setOwner promotes the target to super_admin', () => {
    const a = users.create({ name: 'A', email: 'a@example.com' });
    expect(users.setOwner(a.id).role).toBe('super_admin');
    expect(users.getById(a.id)?.isOwner).toBe(true);
  });

  it('transferOwner flips both rows in one transaction', () => {
    const a = users.create({ name: 'A', email: 'a@example.com', role: 'super_admin' });
    const b = users.create({ name: 'B', email: 'b@example.com', role: 'super_admin' });
    users.setOwner(a.id);

    const result = users.transferOwner(a.id, b.id);
    expect(result.from.isOwner).toBe(false);
    expect(result.to.isOwner).toBe(true);
    expect(users.getOwner()?.id).toBe(b.id);
    // The previous Owner keeps their rank; the transfer does not strip it.
    expect(users.getById(a.id)?.role).toBe('super_admin');
  });

  it('transferOwner refuses a non-owner source and a non-super-admin target', () => {
    const a = users.create({ name: 'A', email: 'a@example.com', role: 'super_admin' });
    const b = users.create({ name: 'B', email: 'b@example.com', role: 'super_admin' });
    const c = users.create({ name: 'C', email: 'c@example.com' });
    users.setOwner(a.id);

    expect(() => users.transferOwner(b.id, c.id)).toThrow(/owner/i);
    expect(() => users.transferOwner(a.id, c.id)).toThrow(/super_admin/i);
    expect(users.getOwner()?.id).toBe(a.id);
  });

  it('createGuarded refuses creation while unclaimed and succeeds once claimed', () => {
    const input = { name: 'A', email: 'a@example.com' };
    expect(() => users.createGuarded(input)).toThrow(InstanceNotClaimedError);

    const owner = users.create({ ...input, role: 'super_admin', isOwner: true });
    expect(users.getOwner()?.id).toBe(owner.id);

    const second = users.createGuarded({ name: 'B', email: 'b@example.com' });
    expect(second.id).toBeGreaterThan(0);
  });

  it('the migration backfills the oldest active super admin', () => {
    const root = users.create({ name: 'Root', email: 'root@example.com', role: 'super_admin' });
    const later = users.create({ name: 'Later', email: 'later@example.com', role: 'super_admin' });
    users.create({ name: 'Plain', email: 'plain@example.com', role: 'user' });

    db.prepare("UPDATE users SET is_owner = 0, status = 'disabled' WHERE id = ?").run(root.id);
    db.prepare('UPDATE users SET is_owner = 0 WHERE id = ?').run(later.id);

    // Re-run the backfill step of 013_owner.sql as the migration does.
    db.prepare(
      `UPDATE users SET is_owner = 1 WHERE id = (
         SELECT id FROM users WHERE role = 'super_admin' AND status = 'active'
         ORDER BY created_at ASC, id ASC LIMIT 1)`,
    ).run();

    expect(users.getOwner()?.id).toBe(later.id);
  });
});
