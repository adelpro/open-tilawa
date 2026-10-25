/** The shapes the API returns, as the dashboard consumes them. */

export type ToolchainBuiltin = 'avoid-ai-writing' | 'remove-ai-marks' | 'fasaha' | 'voice-tune';
export const TOOLCHAIN_BUILTINS = [
  'avoid-ai-writing',
  'remove-ai-marks',
  'fasaha',
  'voice-tune',
] as const;

export type ToolchainStepSimple = {
  id: string | null;
  name: string;
  kind: 'gate' | 'prompt' | 'master';
  enabled: boolean;
  body?: string;
};

export interface Profile {
  id: number;
  name: string;
  isDefault: boolean;
  sampleCount: number;
  manifest: Record<string, unknown>;
  houseStyle: Record<string, unknown> | null;
  voiceCard: string | null;
  /** Ordered post-processing chain; null = the bundled default chain. */
  toolchain: ToolchainStepSimple[];
}

export interface ToolchainStep {
  id: string | null;
  name: string;
  kind: 'gate' | 'prompt' | 'master';
  enabled: boolean;
  body?: string;
}

export interface GeneratedProfile {
  name: string;
  manifest: Record<string, unknown>;
  skillMd: string;
  houseStyle: Record<string, unknown>;
  voiceCard: string;
  files: { name: string; content: string }[];
  excluded: { line: number; text: string; why: string }[];
  warnings: string[];
}

export interface ApiKey {
  id: number;
  label: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  status: 'active' | 'revoked' | 'expired';
}

export interface AuditEntry {
  id: number;
  user_id: number | null;
  key_id: number | null;
  actor_id: number | null;
  action: string;
  target: string | null;
  status: string | null;
  ms: number | null;
  created_at: string;
}

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'user' | 'admin' | 'super_admin';
  status: 'active' | 'disabled';
  isActivated: boolean;
  isOwner?: boolean;
  createdAt?: string;
}

export interface Session {
  id: number;
  fingerprint_json?: Record<string, unknown> | null;
  label?: string;
  createdAt?: string;
  expiresAt?: string;
  isCurrent?: boolean;
  isTrusted?: boolean;
}

/** The `doctor` report, as the operations panel reads it. */
export interface DoctorReport {
  ok: boolean;
  gates: {
    id: string;
    present: boolean;
    path: string | null;
    version: string | null;
    files: { name: string; drift: boolean }[];
  }[];
  python: { path: string | null; version: string | null; problem: string | null };
  skills?: { id: string; present: boolean; version: string | null; drift: boolean }[];
  vendor: { dir: string; versionFile: boolean; mismatches: string[]; unrecorded: string[] };
  store?: { migrations: number; path?: string };
  problems?: string[];
}

export interface BootstrapPrompt {
  promptVersion: number;
  fields: { key: string; required: boolean; type: string }[];
  mcp: string;
  paste: string;
}

export interface ImportPreview {
  manifest: Profile['manifest'];
  warnings: string[];
  excluded: { field: string; text: string; why: string }[];
  promptVersion: number;
  nameTaken: boolean;
}
