/**
 * Uslub core — the deterministic engine, the SQLite store and the migrations,
 * consumed by both Nest apps.
 *
 * Phase 1 lands the store: schema, migrations, repositories and the hashing
 * rules. The profile engine and the two vendored gates arrive in P3.
 */
export * from './types';
export * from './engine/toolchain';
export * from './scopes';
export { openDatabase, migrate, appliedMigrations, type Db } from './store/db';
export {
  sha256,
  hashApiKey,
  canonicalFingerprint,
  fingerprintHash,
  generateApiKey,
  apiKeyPrefix,
  timingSafeHashEquals,
  API_KEY_PREFIX,
  API_KEY_LOOKUP_LENGTH,
} from './store/hash';
export {
  ApiKeysRepository,
  type ApiKeyRecord,
  type KeyVerification,
  type MintApiKeyInput,
} from './store/api-keys.repo';
export {
  UsersRepository,
  InstanceNotClaimedError,
  OwnerTransferError,
  type OwnerTransferFailure,
  type User,
  type UserAvatar,
  type CreateUserInput,
  type UpdateUserInput,
} from './store/users.repo';
export { SessionsRepository } from './store/sessions.repo';
export { EmailOtpRepository, type EmailOtpRecord } from './store/email-otp.repo';
export {
  UserIdentitiesRepository,
  type UserIdentity,
  type IdentityProvider,
} from './store/user-identities.repo';
export { TrustedDevicesRepository } from './store/trusted-devices.repo';
export { RecoveryCodesRepository, type RecoveryCodeRecord } from './store/recovery-codes.repo';
export {
  ProfilesRepository,
  type ProfileRecord,
  type ResolvedProfile,
  type CreateProfileInput,
} from './store/profiles.repo';
export { PreferencesRepository, type PreferenceRecord } from './store/preferences.repo';
export {
  AuditRepository,
  type AuditEntry,
  type RecordAuditInput,
  type AuditStats,
  type AuditStatsDay,
  type AuditStatsTool,
} from './store/audit.repo';
export { DocumentsRepository, type DocumentRecord } from './store/documents.repo';
export {
  GateRunsRepository,
  type GateRunRecord,
  type RecordGateRunInput,
} from './store/gate-runs.repo';

/* --- the engine (P3): profile resolution and the two vendored gates --- */
export { ProfileError, parseManifest, type VoiceManifest } from './engine/manifest';
export {
  PROMPT_VERSION,
  MANIFEST_FIELDS,
  buildBootstrapPrompt,
  extractManifest,
  inspectManifest,
  mcpPrompt,
  pasteBackPrompt,
  type BootstrapMode,
  type BootstrapPrompt,
  type ManifestWarning,
} from './engine/bootstrap';
export {
  GATE_TOOLS,
  resolveVendorDir,
  resolveEngineTools,
  probePython,
  readVendorVersionFile,
  loadBundledVoiceProfile,
  type GateId,
  type GateToolPath,
  type EngineTools,
  type VendorRecord,
} from './engine/tools';
export {
  runGate,
  runGateAsync,
  formatGateReport,
  parseAvoidAiWriting,
  parseRemoveAiMarks,
  type GateEntry,
  type GateResult,
  type GateState,
  type RunGateInput,
} from './engine/gate';
export {
  ProfileService,
  BUNDLED_PROFILE_NAME,
  type ProfileResolution,
  type ResolutionTier,
  type BundledProfile,
} from './engine/profile';
export {
  runDoctor,
  formatDoctorReport,
  type DoctorReport,
  type GateReport,
  type SkillReport,
} from './engine/doctor';
export {
  SKILL_IDS,
  MAX_PROMPT_BYTES,
  composeAuditPrompt,
  composeFasahaPrompt,
  composeWritePrompt,
  profileStateOf,
  readSkillProcedures,
  readSkillVersionFile,
  renderProfileBlock,
  type ComposeInput,
  type PromptProfile,
  type SkillId,
  type SkillProcedure,
} from './engine/skills';
export {
  generateProfile,
  GenerateError,
  NAME_PATTERN,
  BUNDLED_DESCRIPTION,
  type GenerateInput,
  type GenerateResult,
  type ExcludedLine,
} from './engine/generate';
export {
  renderProfile,
  renderVoiceCard,
  stripFrontmatter,
  type RenderResult,
  type RenderedFile,
} from './engine/render';

export const CORE_VERSION = '0.4.0';

export const ENGINE_NOTES = {
  inference: 'client-side only — this service never calls a model',
  gates: 'avoid-ai-writing (gate4) and remove-ai-marks (gate5), pinned in vendor/gates',
  sessions: 'looked up by sha256(token); argon2 is for passwords only',
} as const;
