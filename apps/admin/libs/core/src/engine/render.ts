import { createHash } from 'node:crypto';

/**
 * Voice-card rendering, ported from `render.mjs`.
 *
 * Only the pure half is ported. Upstream's `renderProfile` writes into a harness
 * skill root — symlinking or copying files into `~/.claude/skills` and friends —
 * and a hosted service has no business writing to the caller's disk. The server
 * returns the files with their content and hashes; the client decides where they
 * land. `renderVoiceCard` is kept byte-for-byte, because the card is the artefact
 * people paste into clients that support neither MCP nor plugins.
 */
export interface RenderedFile {
  /** The name the client should use, not a path: the server does not know the target. */
  name: string;
  content: string;
  sha256: string;
}

export interface RenderResult {
  profile: string;
  mode: 'card' | 'files';
  files: RenderedFile[];
  voiceCard: string;
  warnings: string[];
}

const sha256 = (content: string): string =>
  createHash('sha256').update(content, 'utf8').digest('hex');

/** Strip YAML frontmatter: the card is a paste-anywhere document, not a skill. */
export const stripFrontmatter = (text: string): string =>
  String(text)
    .replace(/^---\r?\n[\s\S]*?\r?\n---[ \t]*\r?\n?/, '')
    .trim();

/** Ported verbatim from upstream `renderVoiceCard`. */
export function renderVoiceCard(
  manifest: { name: string; version?: string; languages?: string[] },
  voiceText: string,
  houseStyle: Record<string, unknown> = {},
): string {
  const mechanics = (houseStyle.mechanics ?? {}) as Record<string, unknown>;
  const register = (houseStyle.register ?? []) as string[];
  const lines = [
    `# Voice Card — ${manifest.name}`,
    '',
    `Version ${manifest.version} · Languages: ${(manifest.languages ?? []).join(', ') || 'unspecified'}`,
    '',
    'Self-contained. Paste this into any chat or custom agent when it should write on this',
    "profile's behalf.",
    '',
    '## Voice',
    '',
    stripFrontmatter(voiceText),
    '',
  ];
  if (register.length > 0) {
    lines.push('## House style', '', ...register.map((entry) => `- ${entry}`), '');
  }
  const mechanical = Object.entries(mechanics);
  if (mechanical.length > 0) {
    lines.push('## Mechanics', '', ...mechanical.map(([key, value]) => `- ${key}: ${value}`), '');
  }
  lines.push(
    '## Scope',
    '',
    'Mechanics are all this card checks. It cannot tell you whether a draft sounds like the',
    'voice above.',
    '',
  );
  return lines.join('\n');
}

export interface RenderProfileInput {
  profileName: string;
  manifest: { name: string; version?: string; languages?: string[] };
  /** The profile's prose. The server keeps it in voice_card_md when it was imported. */
  voiceText: string;
  houseStyle: Record<string, unknown> | null;
}

/**
 * Render a profile for a client to write out.
 *
 * `mode: 'card'` returns just the portable card, which is the useful default for
 * a chat client; `mode: 'files'` returns the whole profile as files.
 */
export function renderProfile(
  input: RenderProfileInput,
  mode: 'card' | 'files' = 'card',
): RenderResult {
  const houseStyle = input.houseStyle ?? {};
  const voiceCard = renderVoiceCard(input.manifest, input.voiceText, houseStyle);
  const warnings: string[] = [];

  if (!input.voiceText.trim()) {
    warnings.push(
      'this profile has no voice prose stored, so the card describes mechanics only — import a SKILL.md through generate_profile or the dashboard',
    );
  }

  if (mode === 'card') {
    return {
      profile: input.profileName,
      mode,
      files: [{ name: 'voice-card.md', content: voiceCard, sha256: sha256(voiceCard) }],
      voiceCard,
      warnings,
    };
  }

  const manifestJson = `${JSON.stringify(input.manifest, null, 2)}\n`;
  const houseStyleJson = `${JSON.stringify(houseStyle, null, 2)}\n`;
  const skillMd = `---\nname: ${input.manifest.name}\ndescription: Writing voice profile "${input.manifest.name}".\n---\n\n${stripFrontmatter(input.voiceText)}\n`;

  const files: RenderedFile[] = [
    { name: 'SKILL.md', content: skillMd, sha256: sha256(skillMd) },
    { name: 'writing-profile.json', content: manifestJson, sha256: sha256(manifestJson) },
    { name: 'house-style.json', content: houseStyleJson, sha256: sha256(houseStyleJson) },
    { name: 'voice-card.md', content: voiceCard, sha256: sha256(voiceCard) },
  ];

  return { profile: input.profileName, mode, files, voiceCard, warnings };
}
