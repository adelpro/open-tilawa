import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import { SQLITE_DB } from '../store/store.module';
import { Inject } from '@nestjs/common';
import type { Db } from '@tilawa-admin/core';
import { UsersRepository } from '@tilawa-admin/core';
import { UsersService } from '../users/users.service';
import { MailerService } from '../mailer/mailer.service';

/**
 * Super-admin bootstrap (P20).
 *
 * On a fresh deploy with zero super_admins, the API mints a single-use,
 * short-lived setup token, prints it to stdout, and stores its hash. The /setup
 * route consumes it on first success and creates the super_admin account.
 * After that, the table is empty and /setup refuses.
 */
@Injectable()
export class SetupService implements OnModuleInit {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    @Inject(SQLITE_DB) private readonly db: Db,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly usersRepo: UsersRepository,
    private readonly mailer: MailerService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.setupRequired()) {
      const token = this.generateToken();
      const target = this.config.get<string>('TILAWA_SETUP_EMAIL');
      const baseUrl = this.config.get<string>('TILAWA_PUBLIC_URL');
      if (target) {
        try {
          await this.mailer.sendSetupToken(target, token, baseUrl);
          this.logger.warn(
            `No super_admin exists. Setup token sent to ${target} (fingerprint: ${token.slice(0, 4)}…, valid 1 hour, single use).`,
          );
          this.logger.warn('Visit /setup and enter the token plus your credentials.');
        } catch (err) {
          this.logger.error(
            `Failed to email the setup token to ${target}: ${(err as Error).message}`,
          );
          this.logger.warn(
            `No super_admin exists. Setup token (valid 1 hour, single use): ${token}`,
          );
          if (baseUrl)
            this.logger.warn(`Setup link: ${baseUrl.replace(/\/$/, '')}/setup?token=${token}`);
          this.logger.warn('Visit /setup and enter the token plus your credentials.');
        }
      } else {
        this.logger.warn(`No super_admin exists. Setup token (valid 1 hour, single use): ${token}`);
        if (baseUrl)
          this.logger.warn(`Setup link: ${baseUrl.replace(/\/$/, '')}/setup?token=${token}`);
        this.logger.warn(
          'Visit /setup and enter the token plus your credentials. Set TILAWA_SETUP_EMAIL to deliver it by mail instead.',
        );
      }
    }
  }

  setupRequired(): boolean {
    // Both conditions matter. An Owner means the instance is claimed; an active
    // super_admin without an Owner is a pre-migration or repaired database, and
    // must not be claimable by a stranger — the CLI `owner:set` path fixes it.
    return !this.users.hasOwner() && this.usersRepo.countActiveByRole('super_admin') === 0;
  }

  private pepper(): string {
    return this.config.get<string>('TILAWA_PEPPER') ?? '';
  }

  /** Mint a token, store its hash, return the plaintext (shown once). */
  generateToken(): string {
    const token = crypto.randomBytes(32).toString('base64url');
    const hash = crypto
      .createHash('sha256')
      .update(this.pepper() + token)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    this.db
      .prepare('INSERT INTO setup_tokens (token_hash, expires_at) VALUES (?, ?)')
      .run(hash, expiresAt);
    return token;
  }

  /** Verify without consuming. Returns true if the token is valid and unused. */
  verifyToken(token: string): boolean {
    const hash = crypto
      .createHash('sha256')
      .update(this.pepper() + token)
      .digest('hex');
    const row = this.db
      .prepare('SELECT expires_at, used_at FROM setup_tokens WHERE token_hash = ?')
      .get(hash) as { expires_at: string; used_at: string | null } | undefined;
    if (!row) return false;
    if (row.used_at) return false;
    if (new Date(row.expires_at).getTime() < Date.now()) return false;
    return true;
  }

  /**
   * Consume the token and create the Owner in one transaction.
   *
   * The previous implementation created the account, promoted it, then marked
   * the token used in three separate steps: a failure in between left an orphan
   * account, and two concurrent requests could both pass `setupRequired()`.
   * The conditional `used_at` update and the transaction close both holes.
   */
  async consume(
    token: string,
    input: { name: string; email: string; password: string },
  ): Promise<{ id: number; email: string }> {
    if (!this.setupRequired()) {
      throw new ConflictException('Setup is already complete');
    }
    if (!this.verifyToken(token)) {
      throw new BadRequestException('Invalid or expired setup token');
    }

    const passwordHash = await this.users.hashPassword(input.password);
    const hash = crypto
      .createHash('sha256')
      .update(this.pepper() + token)
      .digest('hex');

    const run = this.db.transaction(() => {
      if (!this.setupRequired()) {
        throw new ConflictException('Setup is already complete');
      }
      const consumed = this.db
        .prepare(
          "UPDATE setup_tokens SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE token_hash = ? AND used_at IS NULL",
        )
        .run(hash);
      if (consumed.changes !== 1) {
        throw new BadRequestException('Invalid or expired setup token');
      }
      return this.usersRepo.create({
        name: input.name,
        email: input.email,
        passwordHash,
        role: 'super_admin',
        isActivated: true,
        isOwner: true,
      });
    });

    const user = run.immediate();
    return { id: user.id, email: user.email };
  }
}
