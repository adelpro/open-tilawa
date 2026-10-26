import { randomInt } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import {
  AuditRepository,
  EmailOtpRepository,
  RecoveryCodesRepository,
  sha256,
  timingSafeHashEquals,
  type User,
} from '@tilawa-admin/core';
import { UsersService } from '@/users/users.service';
import { TrustedDevicesService } from '@/trusted-devices/trusted-devices.service';
import { MailerService } from '@/mailer/mailer.service';
import { AuthService } from '@/auth/auth.service';
import type { FingerprintObj } from '@/auth/types/fingerprint.type';

/** How many codes a recovery set holds, and how long each set lives. */
const RECOVERY_CODE_COUNT = 10;
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_CODE_SEND_BUDGET = 5;
const EMAIL_CODE_MAX_ATTEMPTS = 5;
/** Failed TOTP verifications before the lookup locks up for a quarter hour. */
const TOTP_LOCK_THRESHOLD = 10;
const TOTP_LOCK_WINDOW_MS = 15 * 60 * 1000;

interface TotpFailure {
  count: number;
  until: number;
}

/**
 * The second factor: TOTP enrolment and challenge, emailed one-time codes and
 * single-use recovery codes.
 *
 * Rules the whole module leans on:
 * - A **pending** grant (the 430 cookie) proves the password and nothing more;
 *   completing a challenge mints the full session inside these endpoints and
 *   never anywhere else.
 * - An emailed code buys one session and never trusts the device.
 * - A recovery code buys one session; a fresh set invalidates the old one.
 */
@Injectable()
export class TwoFaService {
  private readonly logger = new Logger(TwoFaService.name);
  /** In-memory, per process: like the signin throttle, it bounds abuse rather than being durable state. */
  private readonly failures = new Map<number, TotpFailure>();

  constructor(
    private readonly users: UsersService,
    private readonly trustedDevices: TrustedDevicesService,
    private readonly audit: AuditRepository,
    private readonly emailOtp: EmailOtpRepository,
    private readonly recoveryCodes: RecoveryCodesRepository,
    private readonly mailer: MailerService,
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Generates a fresh secret, stores it and returns the enrol QR. The account
   * only counts as 2FA-enabled once a first code verifies, so a QR nobody
   * scanned cannot lock anyone out.
   */
  async enable(user: User): Promise<{ qrcode: string }> {
    const secret = authenticator.generateSecret();
    await this.users.update(user.id, { twoFASecrect: secret });
    const otpauth = authenticator.keyuri(user.email, 'Tilawa Admin', secret);
    const qrcode = await QRCode.toDataURL(otpauth);
    this.logger.log(`2fa.enable user=${user.id}`);
    return { qrcode };
  }

  async verify(
    userId: number,
    email: string,
    totp: string,
    fingerprint: FingerprintObj,
    pending: boolean,
  ): Promise<{ message: string; recoveryCodes?: string[]; token?: string }> {
    const user = await this.users.getUserById(userId);
    if (!user?.twoFASecrect) throw new BadRequestException('2FA is not set up for this account');
    this.assertNotLocked(userId);

    const ok = authenticator.verify({ token: totp, secret: user.twoFASecrect });
    if (!ok) {
      this.registerFailure(userId);
      this.audit.record({ actorId: userId, userId, action: 'auth:2fa_verify', status: 'denied' });
      throw new UnauthorizedException('Invalid code');
    }
    this.failures.delete(userId);

    const first = !user.isTwoFAEnabled;
    let recoveryCodes: string[] | undefined;
    if (first) {
      // Enrolment: the first verified code opens the factor and issues the
      // one set of recovery codes.
      recoveryCodes = this.issueRecoveryCodes(userId);
      await this.users.update(userId, { isTwoFAEnabled: true });
    }
    // The device that presented a verified TOTP is trusted. The email fallback
    // is the deliberate exception: verifyEmailCode never calls this.
    await this.trustedDevices.updateTrustedDeviceByFingerprint({ user: userId, fingerprint });
    this.audit.record({
      actorId: userId,
      userId,
      action: first ? 'auth:2fa_enrol' : 'auth:2fa_verify',
      status: 'ok',
    });
    this.logger.log(`2fa.verify ok user=${userId} first=${first}`);
    const token = pending ? await this.authService.generateAndSaveToken(user, fingerprint) : undefined;
    return {
      message: first
        ? '2FA enabled — recovery codes shown once'
        : 'Code verified — this device is now trusted',
      recoveryCodes,
      token,
    };
  }

  /**
   * Sends the emailed fallback code. An account without a second factor gets
   * the same answer and the same status, and sends nothing: the difference
   * would leak which addresses have 2FA on.
   */
  async requestEmailCode(user: User): Promise<{ message: string; status: number }> {
    const genericAnswer = { message: 'If this account has a second factor, the next step is in your inbox', status: 202 };
    if (!user.isTwoFAEnabled) {
      this.logger.warn(`2fa.email_code requested for an account without 2FA user=${user.id}`);
      return genericAnswer;
    }
    const since = new Date(Date.now() - EMAIL_CODE_TTL_MS).toISOString();
    if (this.emailOtp.countIssuedSince(user.id, since) >= EMAIL_CODE_SEND_BUDGET) {
      throw new ForbiddenException('Too many code requests — wait ten minutes and ask again');
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    this.emailOtp.issue({
      userId: user.id,
      codeHash: this.hashOtp(code),
      expiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MS).toISOString(),
    });
    await this.mailer.sendOTPCodeToEmail(
      { id: user.id, email: user.email, name: user.name, locale: user.locale ?? 'en' },
      code,
    );
    this.audit.record({ actorId: user.id, userId: user.id, action: 'auth:2fa_email', status: 'ok' });
    this.logger.log(`2fa.email_code sent user=${user.id}`);
    return genericAnswer;
  }

  /**
   * An emailed code signs one device in once, and trusts it never — the inbox
   * is a fallback, not a credential.
   */
  async verifyEmailCode(
    userId: number,
    presented: string,
    fingerprint: FingerprintObj,
    pending: boolean,
  ): Promise<{ message: string; token?: string }> {
    const record = this.emailOtp.findLive(userId);
    const answer = record && record.code_hash === this.hashOtp(presented);
    if (!record || !answer) {
      if (record) {
        const attempts = this.emailOtp.incrementAttempts(record.id);
        if (attempts >= EMAIL_CODE_MAX_ATTEMPTS) {
          // The counter, not the clock, retires the code.
          this.emailOtp.consume(record.id);
        }
      }
      this.audit.record({
        actorId: userId,
        userId,
        action: 'auth:2fa_email_verify',
        status: 'denied',
      });
      throw new UnauthorizedException('Invalid or expired code');
    }
    // Single use: the loser of a race gets 401, not a second session.
    if (!this.emailOtp.consume(record.id)) throw new UnauthorizedException('Invalid or expired code');

    const user = await this.users.getUserById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const token = pending ? await this.authService.generateAndSaveToken(user, fingerprint) : undefined;
    this.audit.record({
      actorId: userId,
      userId,
      action: 'auth:2fa_email_verify',
      status: 'ok',
    });
    this.logger.log(`2fa.email_code ok user=${userId}`);
    return {
      message: 'Signed in with the emailed code — this device was not added to the trusted list',
      token,
    };
  }

  /** Spends a recovery code and mints the full session. */
  async redeemRecoveryCode(
    userId: number,
    presented: string,
    fingerprint: FingerprintObj,
    pending: boolean,
  ): Promise<{ message: string; token?: string }> {
    const unused = this.recoveryCodes.listUnused(userId);
    const hash = this.hashOtp(presented);
    const match = unused.find((record) => timingSafeHashEquals(record.code_hash, hash));
    if (!match || !this.recoveryCodes.redeem(userId, match.code_hash)) {
      this.audit.record({
        actorId: userId,
        userId,
        action: 'auth:2fa_recovery',
        status: 'denied',
      });
      throw new UnauthorizedException('Unknown or used recovery code');
    }
    const user = await this.users.getUserById(userId);
    if (!user) throw new UnauthorizedException('Account not found');
    const token = pending ? await this.authService.generateAndSaveToken(user, fingerprint) : undefined;
    this.audit.record({
      actorId: userId,
      userId,
      action: 'auth:2fa_recovery',
      status: 'ok',
    });
    this.logger.log(`2fa.recovery ok user=${userId} remaining=${this.recoveryCodes.countUnused(userId)}`);
    return { message: 'Signed in with a recovery code — it cannot be used again', token };
  }

  /** A fresh set, only with a current authenticator code in hand. */
  async regenerateRecoveryCodes(userId: number, totp: string): Promise<{ codes: string[] }> {
    const user = await this.users.getUserById(userId);
    if (!user?.isTwoFAEnabled || !user.twoFASecrect) {
      throw new BadRequestException('2FA is not set up for this account');
    }
    if (!authenticator.verify({ token: totp, secret: user.twoFASecrect })) {
      throw new UnauthorizedException('Invalid code');
    }
    this.recoveryCodes.invalidateAllUnused(userId);
    const codes = this.issueRecoveryCodes(userId);
    this.audit.record({ actorId: userId, userId, action: 'auth:2fa_recovery_regenerate', status: 'ok' });
    this.logger.log(`2fa.recovery regenerate user=${userId}`);
    return { codes };
  }

  // --- helpers -----------------------------------------------------------

  /** Codes are human-copied hex; the store keeps a peppered hash only. */
  private hashOtp(code: string): string {
    return sha256(`${code}:${this.config.get<string>('COOKIE_JWT_SECRET') ?? ''}`);
  }

  private issueRecoveryCodes(userId: number): string[] {
    const chars = 'abcdef0123456789';
    const codes: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i += 1) {
      let raw = '';
      for (let j = 0; j < 8; j += 1) raw += chars[randomInt(0, chars.length)];
      const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
      codes.push(code);
      hashes.push(this.hashOtp(code));
    }
    this.recoveryCodes.issueMany(userId, hashes);
    return codes;
  }

  private assertNotLocked(userId: number): void {
    const entry = this.failures.get(userId);
    if (!entry) return;
    if (Date.now() > entry.until) {
      this.failures.delete(userId);
      return;
    }
    if (entry.count >= TOTP_LOCK_THRESHOLD) {
      throw new BadRequestException(
        'Too many wrong codes — wait 15 minutes and try again',
      );
    }
  }

  private registerFailure(userId: number): void {
    const now = Date.now();
    const entry = this.failures.get(userId);
    if (!entry || now > entry.until) {
      this.failures.set(userId, { count: 1, until: now + TOTP_LOCK_WINDOW_MS });
      return;
    }
    entry.count += 1;
  }
}
