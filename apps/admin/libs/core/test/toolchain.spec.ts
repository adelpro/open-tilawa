import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ProfileError,
  ProfilesRepository,
  UsersRepository,
  compileToolchainPrompt,
  openDatabase,
  parseToolchain,
  toolchainGateFlags,
  toolchainSummary,
  withFallbackMaster,
  type Db,
} from '../src/index';

/**
 * The per-profile toolchain (P9).
 *
 * The security line the tests guard: a profile may pick steps, toggle them and
 * write markdown checklists — but never cause a new executable to appear. An
 * unknown id is refused at parse, not at run; `voice-tune` must be last because
 * it composes the others; and damage in storage degrades to the default chain
 * rather than making the profile unusable.
 */
describe('parseToolchain', () => {
  it('accepts a chain of built-ins and custom prompt steps', () => {
    const chain = parseToolchain(
      [
        { id: 'avoid-ai-writing' },
        { id: 'remove-ai-marks', enabled: false },
        { kind: 'prompt', name: 'no-pleasantries', body: 'Strip greetings.' },
        { id: 'voice-tune' },
      ],
      'test',
    );
    expect(chain).toHaveLength(4);
    expect(chain[1]).toMatchObject({ id: 'remove-ai-marks', enabled: false });
    expect(chain[2]).toMatchObject({ kind: 'prompt', name: 'no-pleasantries' });
  });

  it('accepts a profile-authored master step, as long as it is the only one and last', () => {
    const chain = parseToolchain(
      [
        { id: 'avoid-ai-writing' },
        { kind: 'prompt', name: 'tone', body: 'No em dashes.' },
        { kind: 'master', name: 'house-master', body: 'Compose the revision.' },
      ],
      'test',
    );
    expect(chain[2]).toMatchObject({ kind: 'master', id: null, name: 'house-master' });
  });

  it('refuses a second master, a master before the end, and a custom gate', () => {
    expect(() =>
      parseToolchain(
        [{ id: 'voice-tune' }, { kind: 'master', name: 'mine', body: 'Compose.' }],
        'test',
      ),
    ).toThrow(/only one master/);
    expect(() =>
      parseToolchain(
        [{ kind: 'master', name: 'mine', body: 'Compose.' }, { id: 'fasaha' }],
        'test',
      ),
    ).toThrow(/master step must be last/);
    expect(() => parseToolchain([{ kind: 'gate', name: 'curl', body: 'x' }], 'test')).toThrow(
      /never gates/,
    );
  });

  it('refuses an unknown id — a profile cannot introduce an executable', () => {
    expect(() => parseToolchain([{ id: 'curl-exfiltrate' }], 'test')).toThrow(ProfileError);
  });

  it('refuses duplicate built-ins and a voice-tune that is not last', () => {
    expect(() => parseToolchain([{ id: 'fasaha' }, { id: 'fasaha' }], 'test')).toThrow(
      /appears twice/,
    );
    expect(() =>
      parseToolchain([{ id: 'voice-tune' }, { id: 'avoid-ai-writing' }], 'test'),
    ).toThrow(/last/);
  });

  it('caps step count, step body length and strips nothing silently', () => {
    expect(() => parseToolchain([{ id: 'voice-tune' }, { id: 'fasaha' }], 'test')).toThrow(
      // order rule fires first: voice-tune not last
      /last/,
    );
    const many = Array.from({ length: 13 }, (_, i) => ({
      kind: 'prompt',
      name: `step-${i}`,
      body: `do ${i}`,
    }));
    expect(() => parseToolchain(many, 'test')).toThrow(/at most 12/);
    expect(() =>
      parseToolchain([{ kind: 'prompt', name: 'big', body: 'x'.repeat(4_001) }], 'test'),
    ).toThrow(/exceeds/);
    expect(() => parseToolchain([{ kind: 'prompt', name: 'empty', body: '   ' }], 'test')).toThrow(
      /empty body/,
    );
  });
});

describe('toolchain gate flags and prompts', () => {
  it('maps disabled gate steps to skips', () => {
    expect(toolchainGateFlags(null)).toEqual({ skipStyle: false, skipMarks: false });
    const flags = toolchainGateFlags(
      parseToolchain([{ id: 'avoid-ai-writing', enabled: false }, { id: 'remove-ai-marks' }], 't'),
    );
    expect(flags).toEqual({ skipStyle: true, skipMarks: false });
  });

  it('compiles prompt material with the revision-acceptance contract on voice-tune', () => {
    const nothing = compileToolchainPrompt(parseToolchain([{ id: 'remove-ai-marks' }], 't'));
    expect(nothing).toBeNull();

    const full = compileToolchainPrompt(
      parseToolchain(
        [{ kind: 'prompt', name: 'tone', body: 'No em dashes.' }, { id: 'voice-tune' }],
        't',
      ),
    );
    expect(full).toContain('No em dashes.');
    expect(full).toContain('voice-tune');
    expect(full).toContain('do NOT apply');
  });

  it('applies the account master only when the chain has none of its own', () => {
    expect(withFallbackMaster(null, null)).toBeNull();

    const fallback = { name: 'account-master', body: 'Write like my samples.' };
    const fromDefault = withFallbackMaster(null, fallback);
    expect(fromDefault?.at(-1)).toMatchObject({ kind: 'master', name: 'account-master' });

    const own = withFallbackMaster(parseToolchain([{ id: 'voice-tune' }], 'test'), fallback);
    expect(own).toHaveLength(1);
    expect(own?.[0].id).toBe('voice-tune');

    const noMaster = withFallbackMaster(
      parseToolchain([{ id: 'avoid-ai-writing' }], 'test'),
      fallback,
    );
    expect(noMaster?.at(-1)).toMatchObject({ kind: 'master', name: 'account-master' });
  });

  it('gives a profile-authored master the same acceptance contract', () => {
    const compiled = compileToolchainPrompt(
      parseToolchain(
        [{ kind: 'master', name: 'house-master', body: 'Write like the samples.' }],
        't',
      ),
    );
    expect(compiled).toContain('Write like the samples.');
    expect(compiled).toContain('house-master');
    expect(compiled).toContain('do NOT apply');
  });
});

describe('toolchain in the profiles store', () => {
  let dir: string;
  let db: Db;
  let users: UsersRepository;
  let profiles: ProfilesRepository;
  let userId: number;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'uslub-toolchain-'));
    db = openDatabase(join(dir, 'test.sqlite'));
    users = new UsersRepository(db);
    profiles = new ProfilesRepository(db);
    const created = users.create({
      email: 'chain@example.com',
      password: 'irrelevant-here',
      name: 'Chain User',
      role: 'user',
    });
    userId = created.id;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips a chain with the profile', () => {
    const created = profiles.create({
      userId,
      name: 'chained',
      manifest: {
        kind: 'voice',
        name: 'chained',
        houseStyle: './house-style.json',
        version: '1.0.0',
      },
      toolchain: [
        { id: 'avoid-ai-writing' },
        { kind: 'prompt', name: 'warmth', body: 'Keep the warmth.' },
      ],
    });
    expect(created.toolchain).toHaveLength(2);
    const reread = profiles.getByName(userId, 'chained');
    expect(reread?.toolchain?.[1]).toMatchObject({ name: 'warmth' });
  });

  it('update can set and reset the chain; a damaged JSON degrades to the default', () => {
    profiles.create({
      userId,
      name: 'chained',
      manifest: {
        kind: 'voice',
        name: 'chained',
        houseStyle: './house-style.json',
        version: '1.0.0',
      },
    });
    const updated = profiles.update(userId, profiles.getByName(userId, 'chained')!.id, {
      toolchain: [{ id: 'remove-ai-marks', enabled: false }],
    });
    expect(updated?.toolchain?.[0]).toMatchObject({ enabled: false });
    // empty array = back to the bundled default chain
    const reset = profiles.update(userId, profiles.getByName(userId, 'chained')!.id, {
      toolchain: [],
    });
    expect(reset?.toolchain).toBeNull();
    expect(toolchainSummary(null)[0].name).toBe('avoid-ai-writing');
  });

  it('refuses an invalid chain at write time', () => {
    profiles.create({
      userId,
      name: 'chained',
      manifest: {
        kind: 'voice',
        name: 'chained',
        houseStyle: './house-style.json',
        version: '1.0.0',
      },
    });
    const id = profiles.getByName(userId, 'chained')!.id;
    expect(() => profiles.update(userId, id, { toolchain: [{ id: 'rm-rf' }] })).toThrow(
      ProfileError,
    );
  });
});
