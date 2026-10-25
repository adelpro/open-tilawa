/**
 * The voice-profile manifest, ported from `writing-flow/skills/writing-flow/scripts/profile.mjs`.
 *
 * One deliberate difference: upstream validated that `houseStyle` stayed inside
 * the profile's directory (the Agent Plugins containment rule). On the server a
 * profile is a database row, so there is no directory to escape — the field is a
 * label, and the house style itself arrives as a column. The other rules are kept
 * verbatim, including the exact error strings, because they are the contract the
 * local plugin's tests assert on.
 */
export interface VoiceManifest {
  kind: 'voice';
  name: string;
  version: string;
  languages: string[];
  houseStyle: string;
  arabicStages: string[];
  requiredSkills: string[];
  isDefault: boolean;
}

export class ProfileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProfileError';
  }
}

const asStringArray = (value: unknown, field: string): string[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new ProfileError(`profile manifest: "${field}" must be an array of strings`);
  }
  return value as string[];
};

/**
 * Validate a manifest and name the offending field.
 *
 * `source` is used in messages instead of a file path: for a bundled profile it
 * is the vendor-relative path, for a stored one it is `<user>/<profile name>`.
 */
export function parseManifest(raw: unknown, source = 'manifest'): VoiceManifest {
  let data: unknown = raw;

  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      throw new ProfileError(
        `profile manifest is not valid JSON: ${source} (${(error as Error).message})`,
      );
    }
  }

  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new ProfileError(`profile manifest must be a JSON object: ${source}`);
  }

  const manifest = data as Record<string, unknown>;

  if (manifest.kind !== 'voice') {
    throw new ProfileError(
      `profile manifest: "kind" must be "voice", got ${JSON.stringify(manifest.kind)}`,
    );
  }
  if (typeof manifest.name !== 'string' || manifest.name.trim() === '') {
    throw new ProfileError('profile manifest: "name" must be a non-empty string');
  }
  if (typeof manifest.houseStyle !== 'string' || manifest.houseStyle.trim() === '') {
    throw new ProfileError('profile manifest: "houseStyle" must be a non-empty string');
  }

  return {
    kind: 'voice',
    name: manifest.name,
    version: typeof manifest.version === 'string' ? manifest.version : '0.0.0',
    languages: asStringArray(manifest.languages, 'languages'),
    houseStyle: manifest.houseStyle,
    arabicStages: asStringArray(manifest.arabicStages, 'arabicStages'),
    requiredSkills: asStringArray(manifest.requiredSkills, 'requiredSkills'),
    // The packaged fallback marks itself, so a real profile never competes with it.
    isDefault: manifest.isDefault === true,
  };
}
