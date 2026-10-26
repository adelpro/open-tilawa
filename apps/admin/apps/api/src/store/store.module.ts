import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AuditRepository,
  EmailOtpRepository,
  RecoveryCodesRepository,
  SessionsRepository,
  TrustedDevicesRepository,
  UsersRepository,
  openDatabase,
  type Db,
} from '@tilawa-admin/core';

export const SQLITE_DB = 'TILAWA_ADMIN_SQLITE_DB';

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
 */
@Global()
@Module({
  providers: [
    {
      provide: SQLITE_DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Db =>
        openDatabase(config.get<string>('DB_PATH') ?? './data/tilawa-admin.sqlite'),
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
      provide: TrustedDevicesRepository,
      inject: [SQLITE_DB],
      useFactory: (db: Db) => new TrustedDevicesRepository(db),
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
    DatabaseLifecycle,
  ],
  exports: [
    SQLITE_DB,
    UsersRepository,
    SessionsRepository,
    TrustedDevicesRepository,
    AuditRepository,
    EmailOtpRepository,
    RecoveryCodesRepository,
  ],
})
export class StoreModule {}
