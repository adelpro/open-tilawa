import { ProfileError, parseManifest, type VoiceManifest } from './manifest';
import type { ProfilesRepository, ResolvedProfile } from '../store/profiles.repo';

/**
 * Profile resolution and the lazy default (T3.1, T3.2).
 *
 * Upstream's precedence was: a project pin in the cwd → an installed profile →
 * the bundled fallback, with ambiguity reported only within a tier. A hosted
 * service has one user per key and no filesystem, so the tiers become:
 *
 *   1. the name the caller asked for (it must exist, or it is an error)
 *   2. that user's default row
 *   3. the bundled default, seeded on first use
 *
 * The seed is per user, not global: the store is scoped by `user_id`, and a
 * shared row would be a tenancy hole the moment profiles became editable.
 */
export type ResolutionTier = 'explicit' | 'user-default' | 'bundled-default' | 'fallback';

export interface ProfileResolution {
  profile: ResolvedProfile;
  resolvedBy: ResolutionTier;
  /** True when the user has several profiles and none is marked default. */
  ambiguous: boolean;
  candidates: string[];
  warnings: string[];
}

export interface BundledProfile {
  name: string;
  manifest: VoiceManifest;
  houseStyle: unknown;
  voiceCard: string | null;
  skillMd: string | null;
  source: string;
}

/** Name of the seeded row. The manifest it came from still says `default`. */
export const BUNDLED_PROFILE_NAME = 'voice-default';

export interface ProfileServiceOptions {
  profiles: ProfilesRepository;
  bundled: {
    dir: string;
    manifest: unknown;
    houseStyle: unknown;
    voiceCard: string | null;
    skillMd?: string | null;
  };
}

/** Deep-merge a stored (possibly partial) house style over the bundled defaults. */
const mergeHouseStyle = (bundled: unknown, stored: unknown): Record<string, unknown> => {
  const base = (JSON.parse(JSON.stringify(bundled ?? {})) ?? {}) as Record<string, unknown>;
  const overlay = stored as Record<string, unknown> | null;
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay) || stored instanceof Date) {
    return base;
  }
  for (const [key, value] of Object.entries(overlay)) {
    const current = base[key];
    base[key] =
      current &&
      value &&
      typeof current === 'object' &&
      typeof value === 'object' &&
      !Array.isArray(current) &&
      !Array.isArray(value)
        ? mergeHouseStyle(current, value)
        : value;
  }
  return base;
};

export class ProfileService {
  private readonly profiles: ProfilesRepository;
  private readonly bundled: BundledProfile;

  constructor(options: ProfileServiceOptions) {
    this.profiles = options.profiles;
    // Validated once, at construction: a broken bundled profile must fail loudly
    // at boot rather than look like "this user has no profile".
    this.bundled = {
      name: BUNDLED_PROFILE_NAME,
      manifest: parseManifest(
        options.bundled.manifest,
        `${options.bundled.dir}/writing-profile.json`,
      ),
      houseStyle: options.bundled.houseStyle,
      voiceCard: options.bundled.voiceCard,
      skillMd: options.bundled.skillMd ?? null,
      source: options.bundled.dir,
    };
  }

  get bundledName(): string {
    return this.bundled.name;
  }

  /**
   * Ensure the user has the bundled profile. Idempotent: an existing row is left
   * untouched, because profiles are user-editable and a seed must never overwrite
   * someone's edited house style.
   */
  ensureDefault(userId: number): ResolvedProfile {
    const existing = this.profiles.getByName(userId, this.bundled.name);
    if (existing) return existing;

    const anyDefault = this.profiles.getDefault(userId);
    if (anyDefault) return anyDefault;

    try {
      return this.profiles.create({
        userId,
        name: this.bundled.name,
        manifest: this.bundled.manifest,
        houseStyle: this.bundled.houseStyle,
        voiceCard: this.bundled.voiceCard,
        skillMd: this.bundled.skillMd,
        isDefault: true,
      });
    } catch (error) {
      // Two concurrent first calls can race on UNIQUE(user_id, name); the loser
      // reads the winner's row rather than failing the request.
      const raced = this.profiles.getByName(userId, this.bundled.name);
      if (raced) return raced;
      throw error;
    }
  }

  resolve(userId: number, explicitName?: string | null): ProfileResolution {
    const warnings: string[] = [];
    // A stored profile may carry a partial house style (it is user-editable):
    // sections the user never touched must stay effective from the bundled
    // defaults, or gate4 silently loses whole rule sets.
    // `null` is reserved for a stored style the loader could not read (a damaged
    // profile): that verdict must survive, not be silently healed to the bundled
    // defaults — healing here would erase the signal that something is wrong.
    const merged = (profile: ResolvedProfile): ResolvedProfile => ({
      ...profile,
      houseStyle:
        profile.houseStyle === null
          ? null
          : mergeHouseStyle(this.bundled.houseStyle, profile.houseStyle),
    });

    if (explicitName) {
      const found = this.profiles.getByName(userId, explicitName);
      if (!found) {
        const available = this.profiles.listByUser(userId).map((profile) => profile.name);
        throw new ProfileError(
          `no profile named "${explicitName}"${available.length ? ` — this account has: ${available.join(', ')}` : ''}`,
        );
      }
      return {
        profile: merged(found),
        resolvedBy: 'explicit',
        ambiguous: false,
        candidates: [found.name],
        warnings,
      };
    }

    const seeded = this.ensureDefault(userId);
    if (seeded.isDefault) {
      return {
        profile: merged(seeded),
        resolvedBy: 'user-default',
        ambiguous: false,
        candidates: [seeded.name],
        warnings,
      };
    }

    // The user has profiles but none is marked default (they deleted or unset it).
    // Upstream reported ambiguity and picked deterministically; the same rule is
    // kept, and the caller is told so it can surface it.
    const all = this.profiles.listByUser(userId);
    if (all.length > 0) {
      warnings.push('no default profile is set; using the first by name');
      return {
        profile: merged(all[0]),
        resolvedBy: 'fallback',
        ambiguous: all.length > 1,
        candidates: all.map((profile) => profile.name),
        warnings,
      };
    }

    throw new ProfileError(
      'no voice profile found: no explicit profile, no default, no bundled profile',
    );
  }

  /** `manage_profile(action=set)`: make one of this user's profiles the default. */
  setDefault(userId: number, name: string): ResolvedProfile {
    const found = this.profiles.getByName(userId, name);
    if (!found) throw new ProfileError(`no profile named "${name}"`);
    this.profiles.setDefault(userId, found.id);
    return this.profiles.getByName(userId, name) as ResolvedProfile;
  }
}
