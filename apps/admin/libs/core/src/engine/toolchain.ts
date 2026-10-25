import { ProfileError } from './manifest';

/**
 * The per-profile toolchain — the ordered post-processing chain a profile
 * declares for its drafts: executable gates first, prompt material after.
 *
 * Three kinds of step, with a hard security line between them:
 *
 *   - `gate` — a vendored executable from the house pair (styles mechanics,
 *     invisible Unicode). Executed in a scratch dir, exit contract 0/1/2. The
 *     vendor controls these; a profile only chooses whether each runs.
 *   - `prompt` — markdown checklists the *caller's model* applies when it
 *     revises. No code executed server-side, ever — a user-supplied executable
 *     in hosted multi-tenant is a resource-abuse and escape primitive.
 *   - `master` — the `voice-tune` hub. One final prompt that composes the
 *     upstream findings into the last revision, under the profile's voice.
 *
 * The gate list stays the same two binaries the doctor hashes; "adding a tool"
 * means adding prompt material or asking the operator to vendor a new gate, not
 * shipping user files.
 */

export const TOOLCHAIN_STEP_LIMIT = 12;
export const PROMPT_STEP_BODY_LIMIT = 4_000;
export const PROMPT_STEP_NAME_LIMIT = 64;

/** Built-in steps a profile may toggle. `voice-tune` must be last and unique. */
export const TOOLCHAIN_BUILTINS = [
  'avoid-ai-writing',
  'remove-ai-marks',
  'fasaha',
  'voice-tune',
] as const;

export type ToolchainBuiltin = (typeof TOOLCHAIN_BUILTINS)[number];

interface BuiltinStep {
  kind: 'gate' | 'prompt' | 'master';
  id: ToolchainBuiltin;
  enabled: boolean;
}

interface PromptStep {
  kind: 'prompt' | 'master';
  /** Author-chosen display label, not an executable lookup. */
  name: string;
  /** Markdown checklist the caller's model applies. Never executed. */
  body: string;
  enabled: boolean;
  id: null;
}

export type ToolchainStep = BuiltinStep | PromptStep;

export const isToolchainBuiltin = (id: string): id is ToolchainBuiltin =>
  (TOOLCHAIN_BUILTINS as readonly string[]).includes(id);

/** The bundled default: the two houses gates, nothing else switched on yet. */
export const DEFAULT_TOOLCHAIN: ToolchainStep[] = [
  { kind: 'gate', id: 'avoid-ai-writing', enabled: true },
  {
    kind: 'prompt',
    id: null,
    name: 'fasaha',
    enabled: false,
    body: '(fasaha: see the fasaha prompt)',
  },
].filter(
  (step) =>
    step.kind === 'gate' ||
    // `fasaha` ships listed-but-off: one flip turns Arabic review on without a
    // migration on existing rows. zero-length body is illegal for prompt steps,
    // so the seeded one names where its real prompt lives.
    (step as PromptStep).body.length > 0,
) as ToolchainStep[];

/**
 * Validate a toolchain the client sent. Throws `ProfileError` with a message
 * naming the offending step — the editor shows it next to the input.
 */
export function parseToolchain(value: unknown, label: string): ToolchainStep[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new ProfileError(`${label}: a toolchain is an array of steps`);
  }
  if (value.length > TOOLCHAIN_STEP_LIMIT) {
    throw new ProfileError(`${label}: at most ${TOOLCHAIN_STEP_LIMIT} steps (got ${value.length})`);
  }

  const seenBuiltins = new Set<ToolchainBuiltin>();
  const steps: ToolchainStep[] = [];
  for (const [index, raw] of value.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ProfileError(`${label}: step ${index + 1} is not an object`);
    }
    const candidate = raw as Record<string, unknown>;
    const enabled = candidate.enabled !== false; // absent means on
    const id = typeof candidate.id === 'string' ? candidate.id : null;

    if (id !== null) {
      if (!isToolchainBuiltin(id)) {
        throw new ProfileError(
          `${label}: step ${index + 1} has unknown id "${id}" — built-ins: ${TOOLCHAIN_BUILTINS.join(', ')}`,
        );
      }
      if (seenBuiltins.has(id)) {
        throw new ProfileError(`${label}: "${id}" appears twice`);
      }
      seenBuiltins.add(id);
      // The two executable gates keep their kind; fasaha and voice-tune are
      // prompt material and carry their house kinds.
      const kind: BuiltinStep['kind'] =
        id === 'avoid-ai-writing' || id === 'remove-ai-marks'
          ? 'gate'
          : id === 'fasaha'
            ? 'prompt'
            : 'master';
      steps.push({ kind, id, enabled });
      continue;
    }

    const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
    const body = typeof candidate.body === 'string' ? candidate.body : '';
    // A profile may add prompt material or its own master. It may never name a
    // new executable: a `gate` from the client would be a file to run, which is
    // the one thing a hosted tenant must not be able to introduce.
    if (
      candidate.kind !== undefined &&
      candidate.kind !== 'prompt' &&
      candidate.kind !== 'master'
    ) {
      throw new ProfileError(
        `${label}: step ${index + 1} has kind "${String(candidate.kind)}" — a profile adds prompt or master steps, never gates`,
      );
    }
    if (!name || name.length > 40) {
      throw new ProfileError(`${label}: step ${index + 1} needs a name of 1–40 characters`);
    }
    if (!body.trim()) {
      throw new ProfileError(`${label}: prompt step "${name}" has an empty body`);
    }
    if (body.length > PROMPT_STEP_BODY_LIMIT) {
      throw new ProfileError(
        `${label}: prompt step "${name}" exceeds ${PROMPT_STEP_BODY_LIMIT} characters`,
      );
    }
    // Control characters are how a markdown checklist smuggles terminal escape
    // sequences into a pane; strip them at the door.
    steps.push({
      kind: candidate.kind === 'master' ? 'master' : 'prompt',
      id: null,
      name,
      body,
      enabled,
    });
  }

  // One master, and it runs last: it composes every finding above it. Both the
  // bundled `voice-tune` and a profile's own master count, so the two can never
  // both be on.
  const masters = steps.filter((step) => step.kind === 'master');
  if (masters.length > 1) {
    throw new ProfileError(
      `${label}: only one master step is allowed — ${masters.map(describeStep).join(' and ')} both compose the chain`,
    );
  }
  const master = masters[0];
  if (master && steps.indexOf(master) !== steps.length - 1) {
    throw new ProfileError(`${label}: the master step must be last — it composes the others`);
  }
  return steps;
}

const describeStep = (step: ToolchainStep): string => step.id ?? step.name ?? step.kind;

/**
 * Gate flags derived from the chain. A disabled gate step becomes the same
 * "skipped" entry runGate already knows how to report — a legible skip, not a
 * silent drop.
 */
export const toolchainGateFlags = (
  toolchain: ToolchainStep[] | null,
): {
  skipStyle: boolean;
  skipMarks: boolean;
} => {
  if (!toolchain || toolchain.length === 0) return { skipStyle: false, skipMarks: false };
  const state = (id: ToolchainBuiltin): boolean | null => {
    const step = toolchain.find((candidate) => candidate.id === id && candidate.kind === 'gate');
    return step ? step.enabled : null;
  };
  return {
    skipStyle: state('avoid-ai-writing') === false,
    skipMarks: state('remove-ai-marks') === false,
  };
};

/**
 * The prompt material a full chain implies, for the caller's model to apply.
 *
 * `null` when nothing prompt-shaped is enabled — the common case for the
 * default chain, so run_gate's answer does not grow noise. Prompt-step bodies
 * are embedded verbatim (they were length- and control-checked at parse);
 * voice-tune gets the revision-acceptance contract: the master prompt proposes,
 * the user accepts — never a silent replace.
 */
/**
 * The contract every master pass carries, bundled or authored. It is not the
 * profile's to remove: a master proposes, the person accepts.
 */
const MASTER_CONTRACT = [
  'Compose one proposed revision that satisfies every gate report above and the',
  'profile voice. Present it as a proposal for acceptance: do NOT apply it to the',
  'stored text until the user confirms.',
].join('\n');

/** The account-level master step, used only when the chain has none of its own. */
export interface FallbackMaster {
  name: string;
  body: string;
}

/**
 * The chain a gate run should describe: the profile's own, or the default chain,
 * plus the account's master when that chain has no enabled master.
 *
 * A3 hybrid: a profile may author its own master; the account keeps one simple
 * default so a profile without one still ends in a proposal instead of stopping
 * at findings. The rule is "none of its own", not "none configured" — a profile
 * that deliberately sets its master to none still gets the account default, so
 * "none" is only the absence of a master, never a veto of the account's.
 */
export function withFallbackMaster(
  toolchain: ToolchainStep[] | null,
  master: FallbackMaster | null,
): ToolchainStep[] | null {
  if (!master) return toolchain;
  const chain = toolchain ?? DEFAULT_TOOLCHAIN;
  if (chain.some((step) => step.enabled && step.kind === 'master')) return toolchain;
  return [
    ...chain,
    { kind: 'master', id: null, name: master.name, body: master.body, enabled: true },
  ];
}

export function compileToolchainPrompt(toolchain: ToolchainStep[] | null): string | null {
  if (!toolchain) return null;
  const blocks: string[] = [];

  for (const step of toolchain) {
    if (!step.enabled) continue;
    if (step.id === 'fasaha') {
      blocks.push(
        [
          '## fasaha — Arabic review',
          'For Arabic text, review register and orthography: translationese to natural MSA,',
          'hamza and tashkeel consistency, Arabic punctuation, RTL-safe embedding.',
          'Report findings per line; propose the fix beside each.',
        ].join('\n'),
      );
      continue;
    }
    if (step.id === 'voice-tune') {
      blocks.push(
        [
          '## voice-tune — master pass',
          MASTER_CONTRACT,
          'One hub prompt, not a stack of passes.',
        ].join('\n\n'),
      );
      continue;
    }
    if (step.kind === 'master' && step.id === null) {
      blocks.push([`## ${step.name} — master pass`, step.body, MASTER_CONTRACT].join('\n\n'));
      continue;
    }
    if (step.kind === 'prompt' && step.id === null) {
      blocks.push(`## ${step.name}\n${step.body}`);
    }
  }

  if (blocks.length === 0) return null;
  return [
    'Per-profile toolchain checklist (apply while revising; the executable gates were already run)',
    ...blocks,
  ].join('\n\n');
}

/** Ordered, human-legible summary for reports and the profile panel. */
export const toolchainSummary = (
  toolchain: ToolchainStep[] | null,
): Array<{
  name: string;
  kind: string;
  enabled: boolean;
}> =>
  (toolchain ?? DEFAULT_TOOLCHAIN).map((step) => ({
    name: describeStep(step),
    kind: step.kind,
    enabled: step.enabled,
  }));
