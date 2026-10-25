import { ProfileError, parseManifest, type VoiceManifest } from './manifest';

/**
 * The bootstrap prompt: how a brand-new account gets its first profile from the agent it
 * already talks to, without reading documentation.
 *
 * Two modes, because a new account has two situations and they are not the same. With a key
 * and the MCP server configured, the agent should call the tools and let the server derive
 * the manifest. Without either, the agent interviews the person and hands back JSON that this
 * server parses.
 *
 * The text is a deliverable: a snapshot pins it, the manifest fields are checked against the
 * validator's own list, and every change to the schema has to be a visible change to this
 * file. A prompt generated from documentation would drift the first time someone edited the
 * validator; this one is built beside it.
 */
export const PROMPT_VERSION = 1;

/**
 * The manifest's fields, in the order the validator reads them.
 *
 * `parseManifest` is the authority on what is valid, and it is hand-written TypeScript — an
 * interface cannot be reflected at runtime. So the list lives here and a test asserts that
 * every key the validator returns is described in the prompt. Adding a field without adding
 * it here fails the test rather than shipping a prompt that cannot mention it.
 */
export const MANIFEST_FIELDS: {
  key: keyof VoiceManifest;
  required: boolean;
  type: string;
  says: string;
}[] = [
  {
    key: 'kind',
    required: true,
    type: '"voice"',
    says: 'always the literal string "voice". A different kind is rejected.',
  },
  {
    key: 'name',
    required: true,
    type: 'string',
    says: 'a short lookup name: letters, digits, dot, dash, underscore. `voice-default` is a good default.',
  },
  { key: 'version', required: false, type: 'string', says: 'a semver string. Use "1.0.0".' },
  {
    key: 'languages',
    required: false,
    type: 'string[]',
    says: 'ISO codes the voice covers, e.g. ["en"] or ["en", "ar"].',
  },
  {
    key: 'houseStyle',
    required: true,
    type: 'string',
    says: 'the name of the house style to attach. Use "neutral" when you have no better answer.',
  },
  {
    key: 'arabicStages',
    required: false,
    type: 'string[]',
    says: 'which Arabic passes apply, e.g. ["fasaha"]. Empty when the voice is not Arabic.',
  },
  {
    key: 'requiredSkills',
    required: false,
    type: 'string[]',
    says: 'skills a harness should load before writing in this voice. Usually [].',
  },
];

const schemaBlock = (): string =>
  MANIFEST_FIELDS.map(
    (field) =>
      `- \`${field.key}\` (${field.type}${field.required ? ', required' : ', optional'}): ${field.says}`,
  ).join('\n');

const JSON_EXAMPLE = `{
  "kind": "voice",
  "name": "voice-default",
  "version": "1.0.0",
  "languages": ["en"],
  "houseStyle": "neutral",
  "arabicStages": [],
  "requiredSkills": []
}`;

const PRIVACY = `What to include: writing that is already published, or samples you are happy to send.
Samples are used to derive the profile and are not stored as documents unless you store them
yourself. Do not paste anything confidential.`;

const RULES = `Rules for the profile you return:
- Describe how the person writes, not how they would like to write. Evidence first.
- No pipeline instruction: do not mention skills, gates, stage order, or exit codes.
- No quotes longer than a dozen words, and no personal details that are not about writing.
- If the evidence is thin, keep the profile conservative — "neutral" house style, no required
  skills — instead of inventing specifics.`;

/** The paste-back prompt: the person copies this into an agent that has no Uslub access. */
export const pasteBackPrompt =
  (): string => `You are helping me set up a writing profile in Uslub, a tool that keeps my
writing voice consistent across the apps I write in.

Do not interview me and do not ask for samples first. Answer in this one turn, from what you
already have about how I write: your memory of me, any writing style or custom instruction I
saved in this app, earlier conversations, and any samples I pasted below this prompt. Samples,
when present, are the strongest evidence; a saved style comes next; memory after that.

A reply that asks me something cannot be pasted back, so if you have no evidence at all, fill
in the defaults below and return the object anyway.

Return one JSON object and nothing else, inside a single fenced code block, so it can be
pasted back. The fields:

${schemaBlock()}

For example:

\`\`\`json
${JSON_EXAMPLE}
\`\`\`

${RULES}

${PRIVACY}`;

/** The MCP prompt: the agent has the server configured and can call the tools itself. */
export const mcpPrompt =
  (): string => `You are helping me set up a writing profile in Uslub. The Uslub MCP server is
configured in this session, so use its tools rather than describing them.

1. Ask me for two or three samples of my own writing, or interview me if I would rather not
   paste them: what I sound like when I am direct, what I never say, how I open and close, how
   long my sentences run, whether I use contractions, and how I handle Arabic.
2. Call \`generate_profile\` with those samples and a name (suggest \`voice-default\`). It returns
   a preview and writes nothing.
3. Read the \`excluded\` list back to me: those are lines that looked like pipeline instruction
   rather than voice. If I want them kept, call again with \`includeAll: true\`.
4. When I agree with the preview, call \`generate_profile\` again with \`confirm: true\`. That
   stores it and makes it my default.
5. Call \`get_profile\` and show me the profile you stored, in a few lines.

The manifest it produces has these fields:

${schemaBlock()}

${RULES}

${PRIVACY}`;

export type BootstrapMode = 'mcp' | 'paste';

export interface BootstrapPrompt {
  promptVersion: number;
  /** The manifest fields the prompt describes, so a client can show a schema without parsing prose. */
  fields: { key: string; required: boolean; type: string }[];
  text: string;
}

export const buildBootstrapPrompt = (mode: BootstrapMode): BootstrapPrompt => ({
  promptVersion: PROMPT_VERSION,
  fields: MANIFEST_FIELDS.map(({ key, required, type }) => ({ key, required, type })),
  text: mode === 'mcp' ? mcpPrompt() : pasteBackPrompt(),
});

/**
 * Read a manifest out of whatever the agent replied with.
 *
 * Agents answer with prose around the JSON, or a fenced block, or a fenced block inside
 * prose, and one of them will add a sentence after it. Rather than ask people to trim it by
 * hand, take the first balanced `{…}` and hand it to the validator — which is the same
 * function that will judge the object in the end, so a parse that succeeds here cannot fail
 * later for a reason the person was not told.
 */
export function extractManifest(text: string): {
  manifest: VoiceManifest;
  warnings: string[];
} {
  const warnings: string[] = [];
  const trimmed = text.trim();

  if (trimmed === '')
    throw new ProfileError('nothing was pasted: paste the JSON your agent returned');

  const start = trimmed.indexOf('{');
  if (start === -1) {
    throw new ProfileError(
      'no JSON object found in the pasted text: make sure the agent returned the profile between braces',
    );
  }

  // Walk to the matching brace, string-aware, so a `}` inside "houseStyle" cannot end early.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;
  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  if (end === -1) throw new ProfileError('the JSON object in the pasted text is not closed');

  const candidate = trimmed.slice(start, end);
  if (end < trimmed.length) {
    warnings.push('text after the JSON object was ignored');
  }
  if (start > 0) {
    warnings.push('text before the JSON object was ignored');
  }
  if (/^```/m.test(trimmed)) {
    warnings.push('read from a code block');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch (error) {
    throw new ProfileError(`the JSON is not valid: ${(error as Error).message}`);
  }

  return { manifest: parseManifest(parsed, 'pasted profile'), warnings };
}

/**
 * Lines in a manifest that look like instruction rather than a description of a voice.
 *
 * Only `houseStyle` is scanned, and that is a deliberate narrowing. Every other field holds
 * an identifier whose whole purpose is to name a thing: `requiredSkills: ["fasaha"]` and
 * `arabicStages: ["voice-recheck"]` are correct data, and a check that called them suspicious
 * would flag the engine's own output. `houseStyle` is the one field a model writes free text
 * into, and free text from a model is where an instruction can hide.
 */
const INSTRUCTION_MARKERS: { re: RegExp; why: string }[] = [
  {
    re: /\b(ignore (all )?(previous |prior )?instructions|disregard (all )?(previous|prior)|system prompt)\b/i,
    why: 'looks like a prompt injection',
  },
  { re: /\bexit\s+`?0`?|\brun the gate\b|\bgate\.mjs\b/i, why: 'contains a gate instruction' },
  { re: /\bpipeline\b|\bbounded loop\b|\bstage order\b/i, why: 'describes the pipeline' },
];

export interface ManifestWarning {
  field: string;
  text: string;
  why: string;
}

/** The prose fields: the only place a pasted manifest can smuggle an instruction. */
const PROSE_FIELDS: (keyof VoiceManifest)[] = ['houseStyle'];

export function inspectManifest(manifest: VoiceManifest): ManifestWarning[] {
  const found: ManifestWarning[] = [];
  for (const field of PROSE_FIELDS) {
    const value = manifest[field];
    if (typeof value !== 'string') continue;
    for (const marker of INSTRUCTION_MARKERS) {
      if (marker.re.test(value)) {
        found.push({ field, text: value.slice(0, 160), why: marker.why });
        break;
      }
    }
  }
  return found;
}
