import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ProfileError,
  ProfileService,
  ProfilesRepository,
  PreferencesRepository,
  UsersRepository,
  loadBundledVoiceProfile,
  openDatabase,
  type Db,
} from '../src/index';

const REPO_ROOT = join(__dirname, '..', '..', '..');
const VENDOR = join(REPO_ROOT, 'vendor');

/**
 * Profile resolution and the lazy default (T3.1, T3.2).
 *
 * The seed is per user because the store is scoped by `user_id`: a shared row
 * would be a tenancy hole the moment profiles became editable, so the "two users
 * get two rows" case is asserted rather than assumed.
 */
describe('ProfileService', () => {
  let dir: string;
  let db: Db;
  let users: UsersRepository;
  let profiles: ProfilesRepository;
  let service: ProfileService;
  let adelId: number;
  let otherId: number;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uslub-profiles-'));
    db = openDatabase(join(dir, 'test.sqlite'));
    users = new UsersRepository(db);
    profiles = new ProfilesRepository(db);
    service = new ProfileService({
      profiles,
      bundled: loadBundledVoiceProfile(VENDOR),
    });
    adelId = users.create({ name: 'Adel', email: 'adel@example.com' }).id;
    otherId = users.create({ name: 'Other', email: 'other@example.com' }).id;
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('seeds the bundled profile lazily, once per user', () => {
    expect(profiles.countByUser(adelId)).toBe(0);

    const first = service.resolve(adelId);
    expect(first.resolvedBy).toBe('user-default');
    expect(first.profile.name).toBe('voice-default');
    expect(first.profile.isDefault).toBe(true);

    // The manifest keeps the name it was authored with — the row name is the
    // caller-facing identity, the artefact is left alone.
    expect(first.profile.manifest.name).toBe('default');
    expect(first.profile.manifest.kind).toBe('voice');
    expect(first.profile.houseStyle).toMatchObject({ mechanics: { quotes: 'straight' } });
    expect(first.profile.voiceCard).toContain('#');

    const second = service.resolve(adelId);
    expect(second.profile.id).toBe(first.profile.id);
    expect(profiles.countByUser(adelId)).toBe(1);
  });

  it('seeds per user, never a shared row', () => {
    const mine = service.resolve(adelId);
    const theirs = service.resolve(otherId);

    expect(theirs.profile.id).not.toBe(mine.profile.id);
    expect(profiles.countByUser(adelId)).toBe(1);
    expect(profiles.countByUser(otherId)).toBe(1);
    expect(profiles.listByUser(adelId).map((p) => p.id)).toEqual([mine.profile.id]);
  });

  it('resolves an explicit profile name ahead of the default', () => {
    service.resolve(adelId); // seed
    const personal = profiles.create({
      userId: adelId,
      name: 'adel-personal',
      manifest: {
        kind: 'voice',
        name: 'adel-personal',
        houseStyle: './house-style.json',
        version: '1.0.0',
      },
      houseStyle: { name: 'personal', mechanics: { quotes: 'straight' } },
      isDefault: false,
    });

    const resolved = service.resolve(adelId, 'adel-personal');
    expect(resolved.resolvedBy).toBe('explicit');
    expect(resolved.profile.id).toBe(personal.id);
  });

  it('names what the account actually has when an explicit name is unknown', () => {
    service.resolve(adelId);
    expect(() => service.resolve(adelId, 'nope')).toThrow(ProfileError);
    expect(() => service.resolve(adelId, 'nope')).toThrow(/this account has: voice-default/);
  });

  it('falls back deterministically when nothing is marked default, and says so', () => {
    service.resolve(adelId); // seed, then clear the default the way a dashboard edit could
    const alpha = profiles.create({
      userId: adelId,
      name: 'alpha',
      manifest: { kind: 'voice', name: 'alpha', houseStyle: './house-style.json' },
      isDefault: false,
    });
    profiles.create({
      userId: adelId,
      name: 'beta',
      manifest: { kind: 'voice', name: 'beta', houseStyle: './house-style.json' },
      isDefault: false,
    });
    db.prepare('UPDATE profiles SET is_default = 0 WHERE user_id = ?').run(adelId);

    const resolved = service.resolve(adelId);
    expect(resolved.resolvedBy).toBe('fallback');
    expect(resolved.profile.id).toBe(alpha.id);
    expect(resolved.ambiguous).toBe(true);
    expect(resolved.candidates.sort()).toEqual(['alpha', 'beta', 'voice-default']);
    expect(resolved.warnings[0]).toMatch(/no default profile is set/);
  });

  it('make-default switches exactly one profile, in one transaction', () => {
    const seeded = service.resolve(adelId).profile;
    const personal = profiles.create({
      userId: adelId,
      name: 'personal',
      manifest: { kind: 'voice', name: 'personal', houseStyle: './house-style.json' },
      isDefault: false,
    });

    service.setDefault(adelId, 'personal');

    expect(profiles.getDefault(adelId)?.id).toBe(personal.id);
    expect(profiles.getById(adelId, seeded.id)?.isDefault).toBe(false);
    expect(profiles.listByUser(adelId).filter((profile) => profile.isDefault)).toHaveLength(1);
  });

  it('does not overwrite an edited profile with the bundled default', () => {
    const seeded = service.resolve(adelId).profile;
    profiles.update(adelId, seeded.id, {
      houseStyle: { name: 'edited', mechanics: { quotes: 'curly' } },
    });

    const again = service.resolve(adelId);
    expect(again.profile.houseStyle).toMatchObject({ name: 'edited' });
  });

  it('rejects a manifest that is not a voice profile, naming the field', () => {
    expect(() =>
      profiles.create({
        userId: adelId,
        name: 'broken',
        manifest: { kind: 'style', name: 'broken', houseStyle: './x.json' },
      }),
    ).toThrow(/"kind" must be "voice"/);

    expect(() =>
      profiles.create({
        userId: adelId,
        name: 'broken-2',
        manifest: { kind: 'voice', name: 'broken-2' },
      }),
    ).toThrow(/"houseStyle" must be a non-empty string/);
  });

  it('survives a damaged house style instead of failing the profile', () => {
    const seededFirst = service.resolve(adelId);
    db.prepare('UPDATE profiles SET house_style_json = ? WHERE id = ?').run(
      '{not json',
      seededFirst.profile.id,
    );

    const seeded = service.resolve(adelId);

    expect(seeded.profile.houseStyle).toBeNull();
    expect(seeded.profile.manifest.name).toBe('default');
  });

  it('loads the bundled profile from the vendor directory it was given', () => {
    const bundled = loadBundledVoiceProfile(VENDOR);
    const manifest = JSON.parse(
      readFileSync(join(VENDOR, 'voice-default', 'writing-profile.json'), 'utf8'),
    );

    expect(bundled.manifest).toEqual(manifest);
    expect(bundled.voiceCard).toBeTruthy();

    expect(() => loadBundledVoiceProfile(join(dir, 'nothing-here'))).toThrow(
      /bundled voice profile is missing/,
    );
  });
});

describe('ProfilesRepository and PreferencesRepository tenancy', () => {
  let dir: string;
  let db: Db;
  let users: UsersRepository;
  let profiles: ProfilesRepository;
  let preferences: PreferencesRepository;
  let adelId: number;
  let otherId: number;
  let mineId: number;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uslub-profiles-tenancy-'));
    db = openDatabase(join(dir, 'test.sqlite'));
    users = new UsersRepository(db);
    profiles = new ProfilesRepository(db);
    preferences = new PreferencesRepository(db);
    adelId = users.create({ name: 'Adel', email: 'adel@example.com' }).id;
    otherId = users.create({ name: 'Other', email: 'other@example.com' }).id;
    mineId = profiles.create({
      userId: adelId,
      name: 'mine',
      manifest: { kind: 'voice', name: 'mine', houseStyle: './house-style.json' },
      isDefault: true,
    }).id;
  });

  afterEach(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('refuses every foreign access to a profile or its preferences', () => {
    const added = preferences.add(mineId, adelId, 'prefer shorter sentences');
    expect(added).not.toBeNull();

    expect(profiles.getById(otherId, mineId)).toBeNull();
    expect(profiles.getByName(otherId, 'mine')).toBeNull();
    expect(profiles.getDefault(otherId)).toBeNull();
    expect(profiles.listByUser(otherId)).toEqual([]);
    expect(profiles.setDefault(otherId, mineId)).toBe(false);
    expect(profiles.update(otherId, mineId, { name: 'stolen' })).toBeNull();
    expect(profiles.remove(otherId, mineId)).toBe(false);

    expect(preferences.add(mineId, otherId, 'leak')).toBeNull();
    expect(preferences.listForProfile(mineId, otherId)).toEqual([]);
    expect(preferences.getById(added?.id as number, otherId)).toBeNull();
    expect(preferences.remove(added?.id as number, otherId)).toBe(false);
    expect(preferences.removeAllForProfile(mineId, otherId)).toBe(0);

    // the owner still sees exactly what they wrote
    expect(preferences.textsForProfile(mineId, adelId)).toEqual(['prefer shorter sentences']);
    expect(profiles.getById(adelId, mineId)?.name).toBe('mine');
  });

  it('deletes preferences with their profile', () => {
    preferences.add(mineId, adelId, 'one');
    preferences.add(mineId, adelId, 'two');

    profiles.remove(adelId, mineId);

    expect(preferences.listForProfile(mineId, adelId)).toEqual([]);
    expect(db.prepare('SELECT COUNT(*) AS n FROM preferences').get()).toEqual({ n: 0 });
  });
});
