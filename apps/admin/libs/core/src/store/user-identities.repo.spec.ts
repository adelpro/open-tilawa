import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Db, openDatabase } from './db';
import { UserIdentitiesRepository } from './user-identities.repo';
import { UsersRepository } from './users.repo';

/**
 * The identity table's rules, which are the account-takeover rules: one
 * (provider, subject) belongs to one account, and one account carries at most
 * one identity per provider.
 */
describe('user identities', () => {
  let dir: string;
  let db: Db;
  let users: UsersRepository;
  let identities: UserIdentitiesRepository;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'identities-'));
    db = openDatabase(join(dir, 'test.db'));
    users = new UsersRepository(db);
    identities = new UserIdentitiesRepository(db);
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const person = (email: string) => users.create({ name: email, email });

  it('links a provider and reads it back by subject or by account', () => {
    const user = person('a@example.com');
    const linked = identities.link({
      userId: user.id,
      provider: 'google',
      subject: 'google-1',
      email: 'a@example.com',
    });

    expect(linked.userId).toBe(user.id);
    expect(identities.findByProviderSubject('google', 'google-1')?.id).toBe(linked.id);
    expect(identities.findForUser(user.id, 'google')?.subject).toBe('google-1');
    expect(identities.listForUser(user.id)).toHaveLength(1);
    expect(identities.countForUser(user.id)).toBe(1);
  });

  it('treats the same subject twice as the same link and updates the asserted email', () => {
    const user = person('a@example.com');
    const first = identities.link({
      userId: user.id,
      provider: 'google',
      subject: 'google-1',
      email: 'old@example.com',
    });
    const second = identities.link({
      userId: user.id,
      provider: 'google',
      subject: 'google-1',
      email: 'new@example.com',
    });

    expect(second.id).toBe(first.id);
    expect(second.email).toBe('new@example.com');
    expect(identities.countForUser(user.id)).toBe(1);
  });

  it('allows one identity per provider', () => {
    const user = person('a@example.com');
    identities.link({ userId: user.id, provider: 'google', subject: 'g', email: 'a@example.com' });
    identities.link({ userId: user.id, provider: 'github', subject: '1', email: 'a@example.com' });

    expect(identities.listForUser(user.id)).toHaveLength(2);
  });

  it('refuses a second identity for the same provider on one account', () => {
    const user = person('a@example.com');
    identities.link({ userId: user.id, provider: 'google', subject: 'g1', email: 'a@example.com' });

    expect(() =>
      identities.link({ userId: user.id, provider: 'google', subject: 'g2', email: 'a@example.com' }),
    ).toThrow(/UNIQUE|constraint/i);
  });

  it('refuses the same provider identity on two accounts', () => {
    const first = person('a@example.com');
    const second = person('b@example.com');
    identities.link({ userId: first.id, provider: 'github', subject: '1', email: 'a@example.com' });

    expect(() =>
      identities.link({ userId: second.id, provider: 'github', subject: '1', email: 'b@example.com' }),
    ).toThrow(/another account/i);

    expect(identities.findByProviderSubject('github', '1')?.userId).toBe(first.id);
  });

  it('unlinks only the named provider on the named account', () => {
    const first = person('a@example.com');
    const second = person('b@example.com');
    identities.link({ userId: first.id, provider: 'google', subject: 'g', email: 'a@example.com' });
    identities.link({ userId: second.id, provider: 'google', subject: 'g2', email: 'b@example.com' });

    expect(identities.unlink(first.id, 'google')).toBe(true);
    expect(identities.unlink(first.id, 'google')).toBe(false);
    expect(identities.listForUser(first.id)).toEqual([]);
    expect(identities.listForUser(second.id)).toHaveLength(1);
  });

  it('removes the links with the account', () => {
    const user = person('a@example.com');
    identities.link({ userId: user.id, provider: 'google', subject: 'g', email: 'a@example.com' });

    users.delete(user.id);

    expect(identities.findByProviderSubject('google', 'g')).toBeNull();
  });
});
