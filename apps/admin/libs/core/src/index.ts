/**
 * tilawa-admin core — the SQLite store and the migrations, consumed by the API.
 *
 * The writing-profile engine (profiles, gates, keys, documents) was removed with the
 * fork-only cleanup: the dashboard's own features (TURN, seeders, torrents,
 * reciters) do not use it.
 */
export * from './types';
export { openDatabase, migrate, appliedMigrations, type Db } from './store/db';
export {
  sha256,
  canonicalFingerprint,
  fingerprintHash,
  timingSafeHashEquals,
} from './store/hash';
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
export { TrustedDevicesRepository } from './store/trusted-devices.repo';
export { RecoveryCodesRepository, type RecoveryCodeRecord } from './store/recovery-codes.repo';
export {
  AuditRepository,
  type AuditEntry,
  type RecordAuditInput,
  type AuditStats,
  type AuditStatsDay,
  type AuditStatsTool,
} from './store/audit.repo';

export const CORE_VERSION = '0.4.0';

export {
  deriveReciterState,
  isExpired,
  nextPlacementState,
  PENDING_TTL_HOURS,
  type PlacementState,
  type ReciterState,
} from './store/placement-state';
