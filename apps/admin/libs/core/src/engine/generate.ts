import { parseManifest, type VoiceManifest } from './manifest';
import { renderVoiceCard } from './render';

/**
 * Profile generation, ported from `generate.mjs`.
 *
 * Two things changed for the hosted case, and only two. The source is **text
 * the caller sends** (`samples`) rather than a path on their disk, and the output
 * is **files with content** rather than writes into a directory. The interesting
 * part — deciding which lines are voice and which are pipeline instruction — is
 * kept line for line, because the exit criterion for this phase is that the same
 * input produces the same manifest the plugin produces.
 *
 * Preview is still the default, and the split is reported rather than applied
 * silently: losing a voice to a bad heuristic is worse than reading a list.
 */
export const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;

const PIPELINE_MARKERS: { re: RegExp; why: string }[] = [
  {
    re: /\b(purple-cow-content|avoid-ai-writing|remove-ai-marks|fasaha)\b/,
    why: 'names a pipeline skill',
  },
  {
    re: /\bpipeline\b|\bbounded loop\b|\bstage order\b|\bvoice re-check\b/i,
    why: 'describes the pipeline or its loop',
  },
  { re: /exit\s+`?0`?[^\n]*clean/i, why: 'states the gate exit contract' },
  { re: /\bwrite-gate\b|\bgate\.mjs\b|\bgate4\b|\bgate5\b/i, why: 'references the gate' },
  { re: /avoid-ai-writing|remove-ai-marks/i, why: 'references a gate tool' },
];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?/;

export interface GenerateInput {
  /** The source prose. A SKILL.md with frontmatter is the expected shape. */
  samples: string[];
  name: string;
  description?: string | null;
  includeAll?: boolean;
  /** The house style to attach. Defaults to the bundled neutral one. */
  houseStyle?: Record<string, unknown> | null;
}

export interface ExcludedLine {
  line: number;
  text: string;
  why: string;
}

export interface GenerateResult {
  name: string;
  /**
   * The manifest as it will be written to disk, field for field with what the
   * plugin produces — no `isDefault`, because that key is added by the loader at
   * read time and its presence here would break byte parity.
   */
  manifest: Omit<VoiceManifest, 'isDefault'>;
  skillMd: string;
  houseStyle: Record<string, unknown>;
  voiceCard: string;
  files: { name: string; content: string }[];
  excluded: ExcludedLine[];
  warnings: string[];
}

export class GenerateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GenerateError';
  }
}

export const BUNDLED_DESCRIPTION = (name: string): string =>
  `Writing voice profile "${name}". Use when writing in this person's voice.`;

/**
 * Upstream read a file or a directory's SKILL.md. Here the text arrives; if the
 * caller sends several samples they are joined, which is the only sensible
 * equivalent of "read this directory".
 */
const readSource = (samples: string[]): { text: string } => {
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new GenerateError('generate: the source produced no voice prose: no samples were sent');
  }
  const text = samples.join('\n');
  if (!text.trim()) {
    throw new GenerateError('generate: the source produced no voice prose');
  }
  return { text };
};

const stripFrontmatter = (text: string): { body: string; description: string | null } => {
  const match = FRONTMATTER.exec(text);
  if (!match) return { body: text, description: null };
  const description =
    /^description:\s*(.+)$/m.exec(match[1])?.[1]?.replace(/^["']|["']$/g, '') ?? null;
  return { body: text.slice(match[0].length), description };
};

/** Ported verbatim: a fenced block is dropped whole, including its fences. */
const splitVoice = (
  body: string,
  includeAll: boolean,
): { kept: string[]; excluded: ExcludedLine[] } => {
  if (includeAll) return { kept: body.split(/\r?\n/), excluded: [] };

  const kept: string[] = [];
  const excluded: ExcludedLine[] = [];
  let inFence = false;

  body.split(/\r?\n/).forEach((line, index) => {
    const isFence = /^\s*```/.test(line);
    if (inFence) {
      excluded.push({ line: index + 1, text: line, why: 'inside a code block' });
      if (isFence) inFence = false;
      return;
    }
    if (isFence) {
      inFence = true;
      excluded.push({ line: index + 1, text: line, why: 'opens a code block' });
      return;
    }
    const marker = PIPELINE_MARKERS.find((entry) => entry.re.test(line));
    if (marker) excluded.push({ line: index + 1, text: line, why: marker.why });
    else kept.push(line);
  });

  return { kept, excluded };
};

const tidy = (lines: string[]): string =>
  lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export function generateProfile(input: GenerateInput): GenerateResult {
  const { name } = input;

  if (!name) throw new GenerateError('generate: a profile name is required');
  if (!NAME_PATTERN.test(name)) {
    throw new GenerateError(`generate: name "${name}" is not usable as a profile name`);
  }

  const { text } = readSource(input.samples);
  const { body, description: sourceDescription } = stripFrontmatter(text);
  const { kept, excluded } = splitVoice(body, input.includeAll === true);

  const voice = tidy(kept);
  if (!voice) throw new GenerateError('generate: the source produced no voice prose');

  const houseStyle = input.houseStyle ?? null;
  if (!houseStyle) {
    throw new GenerateError(
      'generate: no house style to attach — the bundled voice-default house style was not given',
    );
  }

  const effectiveDescription = input.description ?? sourceDescription ?? BUNDLED_DESCRIPTION(name);

  // The manifest exactly as the plugin builds it, in the same order, because the
  // parity check compares this object byte for byte. `parseManifest` validates it
  // (and would throw on a mistake) without being the thing that is serialised:
  // it normalises in an `isDefault` that upstream's file does not carry.
  const manifest = {
    kind: 'voice' as const,
    name,
    version: '1.0.0',
    languages: ['en', 'ar-MSA'],
    houseStyle: './house-style.json',
    arabicStages: ['fasaha', 'voice-recheck'],
    requiredSkills: ['purple-cow-content', 'fasaha', 'avoid-ai-writing', 'remove-ai-marks'],
  };
  parseManifest(manifest, `generate:${name}`);

  const skillMd = `---\nname: ${name}\ndescription: ${effectiveDescription}\n---\n\n${voice}\n`;
  const houseStyleJson = `${JSON.stringify(houseStyle, null, 2)}\n`;
  const voiceCard = renderVoiceCard(manifest, skillMd, houseStyle);

  return {
    name,
    manifest,
    skillMd,
    houseStyle,
    voiceCard,
    files: [
      { name: 'SKILL.md', content: skillMd },
      { name: 'writing-profile.json', content: `${JSON.stringify(manifest, null, 2)}\n` },
      { name: 'house-style.json', content: houseStyleJson },
      { name: 'voice-card.md', content: voiceCard },
    ],
    excluded,
    warnings:
      excluded.length > 0 && input.includeAll !== true
        ? [
            `${excluded.length} line(s) look like pipeline instruction and were left out. Review "excluded", then apply with confirm: true, or pass includeAll to keep them.`,
          ]
        : [],
  };
}
