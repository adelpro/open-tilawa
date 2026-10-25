import type { Db } from './db';
import { ProfileError, parseManifest, type VoiceManifest } from '../engine/manifest';
import { parseToolchain, type ToolchainStep } from '../engine/toolchain';

/**
 * A stored voice profile.
 *
 * `name` is the lookup identity the caller passes explicitly (`voice-default`
 * for the seeded row). The manifest keeps whatever `name` it was authored with —
 * upstream's bundled manifest says `default` — and that stays visible in every
 * report, so nothing here silently rewrites someone's artefact.
 */
export interface ProfileRecord {
  id: number;
  user_id: number;
  name: string;
  is_default: number;
  manifest_json: string;
  house_style_json: string | null;
  voice_card_md: string | null;
  skill_md: string | null;
  toolchain_json?: string | null;
  sample_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProfileInput {
  userId: number;
  name: string;
  manifest: VoiceManifest | Record<string, unknown>;
  houseStyle?: unknown;
  voiceCard?: string | null;
  skillMd?: string | null;
  toolchain?: unknown | null;
  isDefault?: boolean;
  sampleCount?: number;
}

export interface ResolvedProfile {
  id: number;
  name: string;
  manifest: VoiceManifest;
  houseStyle: Record<string, unknown> | null;
  voiceCard: string | null;
  skillMd: string | null;
  /** Parsed toolchain; null = the bundled default chain. */
  toolchain: ToolchainStep[] | null;
  sampleCount: number;
  isDefault: boolean;
}

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ','now')";

function toResolved(record: ProfileRecord): ResolvedProfile {
  const manifest = parseManifest(record.manifest_json, `${record.user_id}/${record.name}`);
  let houseStyle: Record<string, unknown> | null = null;
  if (record.house_style_json) {
    try {
      const parsed: unknown = JSON.parse(record.house_style_json);
      houseStyle =
        parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      // A damaged house style must not make the profile unusable: the gates then
      // run without --config and report what they find, which is honest.
      houseStyle = null;
    }
  }
  let toolchain: ToolchainStep[] | null = null;
  if (record.toolchain_json) {
    try {
      toolchain = parseToolchain(
        JSON.parse(record.toolchain_json),
        `${record.user_id}/${record.name}`,
      );
    } catch {
      // A damaged chain degrades to the default rather than making the profile
      // unusable; the gates still run, they just run the house default set.
      toolchain = null;
    }
  }
  return {
    id: record.id,
    name: record.name,
    manifest,
    houseStyle,
    toolchain,
    voiceCard: record.voice_card_md,
    skillMd: record.skill_md ?? null,
    sampleCount: record.sample_count,
    isDefault: record.is_default === 1,
  };
}

export class ProfilesRepository {
  constructor(private readonly db: Db) {}

  create(input: CreateProfileInput, userIdOverride?: number): ResolvedProfile {
    const userId = userIdOverride ?? input.userId;
    // Validated before it reaches the column, and the *validated* object is what
    // is stored: unknown fields are dropped here rather than travelling on.
    const manifest = parseManifest(input.manifest, `${userId}/${input.name}`);
    const info = this.db
      .prepare(
        `INSERT INTO profiles (user_id, name, is_default, manifest_json, house_style_json, voice_card_md, skill_md, toolchain_json, sample_count)
         VALUES (@user_id, @name, @is_default, @manifest_json, @house_style_json, @voice_card_md, @skill_md, @toolchain_json, @sample_count)`,
      )
      .run({
        user_id: userId,
        name: input.name,
        is_default: input.isDefault ? 1 : 0,
        manifest_json: JSON.stringify(manifest),
        house_style_json: input.houseStyle ? JSON.stringify(input.houseStyle) : null,
        voice_card_md: input.voiceCard ?? null,
        skill_md: input.skillMd ?? null,
        // Validated *here*, not on the caller's honour: the stored JSON is always
        // a chain `parseToolchain` re-accepts, and an invalid array is refused,
        // never truncated silently.
        toolchain_json:
          input.toolchain === undefined
            ? null
            : input.toolchain === null
              ? null
              : parseToolchain(input.toolchain, input.name).length === 0
                ? null
                : JSON.stringify(parseToolchain(input.toolchain, input.name)),
        sample_count: input.sampleCount ?? 0,
      });

    if (input.isDefault) {
      this.setDefault(userId, Number(info.lastInsertRowid));
    }
    return this.getById(userId, Number(info.lastInsertRowid)) as ResolvedProfile;
  }

  /** Returns the row, or null if this user does not have a profile under that name. */
  getByName(userId: number, name: string): ResolvedProfile | null {
    const row = this.db
      .prepare('SELECT * FROM profiles WHERE user_id = ? AND name = ?')
      .get(userId, name) as ProfileRecord | undefined;
    return row ? toResolved(row) : null;
  }

  getDefault(userId: number): ResolvedProfile | null {
    const row = this.db
      .prepare('SELECT * FROM profiles WHERE user_id = ? AND is_default = 1')
      .get(userId) as ProfileRecord | undefined;
    return row ? toResolved(row) : null;
  }

  getById(userId: number, id: number): ResolvedProfile | null {
    const row = this.db
      .prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?')
      .get(id, userId) as ProfileRecord | undefined;
    return row ? toResolved(row) : null;
  }

  listByUser(userId: number): ResolvedProfile[] {
    const rows = this.db
      .prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY is_default DESC, name ASC')
      .all(userId) as ProfileRecord[];
    return rows.map(toResolved);
  }

  countByUser(userId: number): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM profiles WHERE user_id = ?')
      .get(userId) as { n: number };
    return row.n;
  }

  /** Exactly one default per user: the switch and the old default are one transaction. */
  setDefault(userId: number, id: number): boolean {
    const run = this.db.transaction(() => {
      const target = this.db
        .prepare('SELECT id FROM profiles WHERE id = ? AND user_id = ?')
        .get(id, userId);
      if (!target) return false;
      this.db
        .prepare(
          `UPDATE profiles SET is_default = 0, updated_at = ${NOW} WHERE user_id = ? AND is_default = 1`,
        )
        .run(userId);
      this.db
        .prepare(
          `UPDATE profiles SET is_default = 1, updated_at = ${NOW} WHERE id = ? AND user_id = ?`,
        )
        .run(id, userId);
      return true;
    });
    return run();
  }

  update(
    userId: number,
    id: number,
    patch: {
      name?: string;
      manifest?: unknown;
      houseStyle?: unknown;
      voiceCard?: string | null;
      skillMd?: string | null;
      toolchain?: unknown | null;
      sampleCount?: number;
    },
  ): ResolvedProfile | null {
    const existing = this.getById(userId, id);
    if (!existing) return null;

    const assignments: string[] = [];
    const params: Record<string, unknown> = { id, user_id: userId };

    if (patch.name !== undefined) {
      assignments.push('name = @name');
      params.name = patch.name;
    }
    if (patch.manifest === undefined && patch.name !== undefined && existing.manifest) {
      patch.manifest = { ...(existing.manifest as unknown as Record<string, unknown>), name: patch.name };
    }
    if (patch.manifest !== undefined) {
      // Validated before it reaches the column, so a bad manifest cannot be stored
      // and then fail on every later read.
      const validated = parseManifest(patch.manifest, `${userId}/${patch.name ?? existing.name}`);
      assignments.push('manifest_json = @manifest_json');
      params.manifest_json = JSON.stringify(validated);
    }
    if (patch.houseStyle !== undefined) {
      assignments.push('house_style_json = @house_style_json');
      params.house_style_json = patch.houseStyle === null ? null : JSON.stringify(patch.houseStyle);
    }
    if (patch.voiceCard !== undefined) {
      assignments.push('voice_card_md = @voice_card_md');
      params.voice_card_md = patch.voiceCard;
    }
    if (patch.skillMd !== undefined) {
      assignments.push('skill_md = @skill_md');
      params.skill_md = patch.skillMd;
    }
    if (patch.toolchain !== undefined) {
      // Same backing store/validation as create, with one more rule: an empty
      // array resets to the bundled default (null), which the editor uses as
      // 'use the house default chain'.
      assignments.push('toolchain_json = @toolchain_json');
      const chain = patch.toolchain === null ? [] : parseToolchain(patch.toolchain, 'toolchain');
      params.toolchain_json = chain.length === 0 ? null : JSON.stringify(chain);
    }
    if (patch.sampleCount !== undefined) {
      assignments.push('sample_count = @sample_count');
      params.sample_count = patch.sampleCount;
    }
    if (assignments.length === 0) return existing;

    assignments.push(`updated_at = ${NOW}`);
    this.db
      .prepare(
        `UPDATE profiles SET ${assignments.join(', ')} WHERE id = @id AND user_id = @user_id`,
      )
      .run(params);

    return this.getById(userId, id);
  }

  remove(userId: number, id: number): boolean {
    return (
      this.db.prepare('DELETE FROM profiles WHERE id = ? AND user_id = ?').run(id, userId).changes >
      0
    );
  }

  /** Guard for the caller deciding whether the lazy seed is needed. */
  isEmptyFor(userId: number): boolean {
    return this.countByUser(userId) === 0;
  }

  /** The stored identity of a profile, for reports that must not leak a hash. */
  describe(userId: number, name: string): string {
    const profile = this.getByName(userId, name);
    if (!profile) throw new ProfileError(`no profile named ${name}`);
    return `${name} (manifest "${profile.manifest.name}" v${profile.manifest.version})`;
  }
}
