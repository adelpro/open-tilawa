import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VendorRecord, VendorVersionFile } from './tools';

/**
 * Vendored prompt procedures (T8.5).
 *
 * A prompt carries a **condensed procedure** — a stage list and its stop conditions,
 * one to two kilobytes — never a skill's `SKILL.md`. Inlining a skill body would ship
 * someone else's licence with the product, bloat every `prompts/get` response, and
 * turn a routine skill update into a redeploy.
 *
 * The procedures are hashed and recorded exactly like the gates, so `doctor` can tell
 * an accidental edit from a deliberate one.
 */
export const SKILL_IDS = ['write', 'audit', 'fasaha'] as const;
export type SkillId = (typeof SKILL_IDS)[number];

export interface SkillProcedure {
  id: SkillId;
  present: boolean;
  path: string | null;
  version: string | null;
  upstream: string | null;
  text: string | null;
  /** The file on disk does not match the recorded hash. */
  drift: boolean;
}

/** The ceiling for a served prompt body. Past this a client pays for it every turn. */
export const MAX_PROMPT_BYTES = 4096;

/** Room reserved for the profile block and the caller's own text. */
const PROFILE_BUDGET = 900;
const DOCUMENT_BUDGET = 8000;

export function readSkillProcedures(vendorDir: string): SkillProcedure[] {
  const dir = join(vendorDir, 'skills');
  const records = readSkillVersionFile(dir)?.records ?? [];

  return SKILL_IDS.map((id) => {
    const record: VendorRecord | undefined = records.find((entry) => entry.id === id);
    const path = join(dir, id, 'PROCEDURE.md');
    const present = existsSync(path);

    let text: string | null = null;
    let drift = false;
    if (present) {
      const bytes = readFileSync(path);
      text = bytes.toString('utf8').trim();
      const expected = record?.files?.['PROCEDURE.md'];
      // No record is drift too: an unrecorded procedure can be edited by anyone who
      // can write to the volume, and nothing would notice.
      drift = !expected || createHash('sha256').update(bytes).digest('hex') !== expected;
    }

    return {
      id,
      present,
      path: present ? path : null,
      version: record?.version ?? null,
      upstream: record?.upstream ?? null,
      text,
      drift,
    };
  });
}

export function readSkillVersionFile(dir: string): VendorVersionFile | null {
  const file = join(dir, 'VERSION');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as VendorVersionFile;
  } catch {
    return null;
  }
}

/** The profile state a prompt may carry. Derived, never pasted as the raw row. */
export interface PromptProfile {
  name: string;
  version: string | null;
  languages: string[];
  houseStyle: unknown;
  requiredSkills: string[];
}

/** Narrow an unknown manifest without trusting its shape. */
export function profileStateOf(
  profile: { name: string; manifest?: unknown; houseStyle?: unknown },
  requiredSkillsFallback: string[] = [],
): PromptProfile {
  const manifest = (profile.manifest ?? {}) as Record<string, unknown>;
  const languages = Array.isArray(manifest.languages)
    ? manifest.languages.filter((entry): entry is string => typeof entry === 'string')
    : [];
  const required = Array.isArray(manifest.requiredSkills)
    ? manifest.requiredSkills.filter((entry): entry is string => typeof entry === 'string')
    : requiredSkillsFallback;

  return {
    name: profile.name,
    version: typeof manifest.version === 'string' ? manifest.version : null,
    languages,
    houseStyle: profile.houseStyle ?? null,
    requiredSkills: required,
  };
}

/**
 * The profile block.
 *
 * House style is the part that actually changes a draft, so it is carried — but
 * compactly, and cut rather than dumped: an imported profile can hold a house style
 * far larger than the prompt budget, and a prompt nobody can afford to send is worse
 * than one that says what it left out.
 */
export function renderProfileBlock(profile: PromptProfile): string {
  const lines = [
    '## Profile in force',
    `${profile.name}${profile.version ? ` (version ${profile.version})` : ''}`,
    `Languages: ${profile.languages.join(', ') || 'unspecified'}`,
  ];

  if (profile.requiredSkills.length > 0) {
    lines.push(`Required skills: ${profile.requiredSkills.join(', ')}`);
  }

  const house = renderHouseStyle(profile.houseStyle);
  if (house) {
    lines.push('', '### House style', house.text);
    if (house.truncated) {
      lines.push(
        '(truncated — the full house style is available from `get_profile` if you need it)',
      );
    }
  }

  return lines.join('\n');
}

function renderHouseStyle(houseStyle: unknown): { text: string; truncated: boolean } | null {
  if (!houseStyle || typeof houseStyle !== 'object') return null;

  const style = houseStyle as Record<string, unknown>;
  const parts: string[] = [];

  // The name first: which house style is in force is the one-line answer a caller
  // needs when a draft reads wrong and they are deciding whether to trust it.
  if (typeof style.name === 'string' && style.name.trim()) parts.push(style.name.trim());

  if (Array.isArray(style.register)) {
    for (const entry of style.register) {
      if (typeof entry === 'string') parts.push(`- ${entry}`);
    }
  }
  if (style.mechanics && typeof style.mechanics === 'object') {
    const mechanics = Object.entries(style.mechanics as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(', ');
    if (mechanics) parts.push('', `mechanics — ${mechanics}`);
  }

  // A house style with an unfamiliar shape still gets carried; a prompt that silently
  // drops the writer's rules is worse than one that carries them verbatim.
  if (parts.length === 0) parts.push(JSON.stringify(style));

  let text = parts.join('\n');
  const truncated = text.length > PROFILE_BUDGET;
  if (truncated) text = `${text.slice(0, PROFILE_BUDGET).trimEnd()}…`;
  return { text, truncated };
}

export interface ComposeInput {
  profile: PromptProfile;
  procedure: string | null;
  /** What the caller asked for, or the draft to review. */
  text?: string | null;
  documentId?: string | null;
  /**
   * The named document's text, resolved by the caller.
   *
   * Passed in rather than looked up here: `libs/core` has no store connection, and a
   * module-level reader would be shared state across tenants. The MCP layer owns the
   * tenant-scoped repository and hands the text over.
   */
  documentText?: string | null;
}

const procedureOf = (procedure: string | null): string =>
  procedure?.trim() ||
  '(no procedure is vendored — follow the profile state below and the gate contract: 0 clean, 1 violations, 2 the gate could not run)';

const sourceOf = (input: ComposeInput): string => {
  if (input.text?.trim()) return input.text.trim();

  if (input.documentId && input.documentText) {
    const text = input.documentText;
    const truncated = text.length > DOCUMENT_BUDGET;
    const body = truncated ? `${text.slice(0, DOCUMENT_BUDGET)}\n…(truncated)` : text;
    return `Document \`${input.documentId}\`\n\n${body}`;
  }

  if (input.documentId) {
    return `Document \`${input.documentId}\` — its text could not be read; ask for the text instead.`;
  }

  return '(nothing supplied)';
};

const finish = (text: string): string =>
  text.length <= MAX_PROMPT_BYTES
    ? text
    : `${text.slice(0, MAX_PROMPT_BYTES - 20).trimEnd()}\n…(truncated)`;

export const composeWritePrompt = (input: ComposeInput & { request: string }): string =>
  finish(
    [
      procedureOf(input.procedure),
      '',
      '---',
      '',
      renderProfileBlock(input.profile),
      '',
      '---',
      '',
      '## Request',
      input.request.trim(),
      '',
      'Before you hand anything back: run `run_gate` on the draft. `0` clean, `1` violations listed, `2` the gate could not run — report it rather than claiming a pass.',
    ].join('\n'),
  );

export const composeAuditPrompt = (input: ComposeInput): string =>
  finish(
    [
      procedureOf(input.procedure),
      '',
      '---',
      '',
      renderProfileBlock(input.profile),
      '',
      '---',
      '',
      '## Draft to audit',
      sourceOf(input),
      '',
      'Report findings grouped by pass, quoting each fragment. Then one line with the gate code and the count remaining.',
    ].join('\n'),
  );

export const composeFasahaPrompt = (input: ComposeInput): string =>
  finish(
    [
      procedureOf(input.procedure),
      '',
      '---',
      '',
      renderProfileBlock(input.profile),
      '',
      'The target register is Modern Standard Arabic unless the profile says otherwise.',
      'The Arabic text to review is the only thing under review: do not translate it, and do not',
      'rewrite it wholesale.',
      '',
      '---',
      '',
      '## Arabic text to review',
      sourceOf(input),
    ].join('\n'),
  );
