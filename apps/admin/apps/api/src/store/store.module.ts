import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiKeysRepository,
  AuditRepository,
  EmailOtpRepository,
  RecoveryCodesRepository,
  PreferencesRepository,
  ProfileService,
  ProfilesRepository,
  SessionsRepository,
  TrustedDevicesRepository,
  UsersRepository,
  UserIdentitiesRepository,
  loadBundledVoiceProfile,
  openDatabase,
  resolveEngineTools,
  type Db,
  type EngineTools,
} from '@tilawa-admin/core';

export const SQLITE_DB = 'USLUB_SQLITE_DB';
export const ENGINE_TOOLS = 'USLUB_ENGINE_TOOLS';

/**
 * Closes the handle on shutdown, so WAL state is checkpointed on a clean restart
 * rather than recovered on the next boot.
 */
class DatabaseLifecycle implements OnApplicationShutdown {
  constructor(@Inject(SQLITE_DB) private readonly db: Db) {}

  onApplicationShutdown(): void {
    if (this.db.open) {
      this.db.close();
    }
  }
}

/**
 * One database handle per process, plus the repositories over it.
 *
 * Opened once and shared: better-sqlite3 is synchronous, and a handle per module
 * would only recreate write contention. `DB_PATH` is optional in config
 * validation, so a missing value starts on the default compose also uses.
 *
 * The engine arrives here with the dashboard (P6), which needs profile
 * resolution for its own screens; the resolves happen at boot so a missing gate
 * fails the start with a named cause instead of failing a request.
 */
@Global()
@Module({
  providers: [
    {
      provide: SQLITE_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Db =>
        openDatabase(config.get<string>('DB_PATH') ?? './data/uslub.sqlite'),
    },
    {
      provide: ENGINE_TOOLS,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EngineTools =>
        resolveEngineTools({ vendorDir: config.get<string>('USLUB_VENDOR_DIR') }),
    },
    {
      provide: UsersRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new UsersRepository(db),
    },
    {
      provide: SessionsRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new SessionsRepository(db),
    },
    {
      // The token is a string, not the class: the OAuth service injects it by name so
      // the repository stays a plain class with no decorator of its own.
      provide: 'USLUB_USER_IDENTITIES',
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new UserIdentitiesRepository(db),
    },
    {
      provide: TrustedDevicesRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new TrustedDevicesRepository(db),
    },
    {
      provide: ApiKeysRepository,
      inject: [SQLITE_DB, ConfigService],
      useFactory: (db: Db, config: ConfigService) =>
        new ApiKeysRepository(db, config.get<string>('USLUB_PEPPER') ?? ''),
    },
    {
      provide: AuditRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new AuditRepository(db),
    },
    {
      provide: EmailOtpRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new EmailOtpRepository(db),
    },
    {
      provide: RecoveryCodesRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new RecoveryCodesRepository(db),
    },
    {
      provide: ProfilesRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new ProfilesRepository(db),
    },
    {
      provide: PreferencesRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new PreferencesRepository(db),
    },
    {
      provide: ProfileService,
      inject: [ProfilesRepository, ENGINE_TOOLS],
      useFactory: (profiles: ProfilesRepository, tools: EngineTools) =>
        new ProfileService({ profiles, bundled: loadBundledVoiceProfile(tools.vendorDir) }),
    },
    DatabaseLifecycle,
  ],
  exports: [
    SQLITE_DB,
    ENGINE_TOOLS,
    UsersRepository,
    'USLUB_USER_IDENTITIES',
    SessionsRepository,
    TrustedDevicesRepository,
    ApiKeysRepository,
    AuditRepository,
    EmailOtpRepository,
    RecoveryCodesRepository,
    ProfilesRepository,
    PreferencesRepository,
    ProfileService,
  ],
})
export class StoreModule {}
