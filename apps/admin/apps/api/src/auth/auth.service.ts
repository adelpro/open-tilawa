import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { TrustedDevicesService } from '@/trusted-devices/trusted-devices.service';
import { TempLinksService } from '@/temp-links/temp-links.service';
import { AuthenticatedUser } from './types/authenticatedUser.type';
import type { User, UserIdentitiesRepository } from '@tilawa-admin/core';
import { FingerprintObj } from './types/fingerprint.type';
import { MailerService } from '../mailer/mailer.service';
import { TokensService } from '../tokens/tokens.service';
import { UsersService } from '../users/users.service';
import { SignupUserDTO } from './dtos/signupUser.dto';
import { signinUserDTO } from './dtos/signinUser.dto';
import { argonConfig } from '../config/argon.config';
import { getCookieOptions } from '../config/cookie.config';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CookieOptions } from 'express';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { randomUUID } from 'node:crypto';
import { TokenPayload } from '@/tokens/types/TokenPayload';

/**
 * The account flows, ported from `nextpalestine` with four deliberate changes:
 *
 * 1. **Sign-in failures are generic.** Upstream answered 404 `user not found`
 *    for an unknown address and 401 `Invalid credentials` for a wrong password,
 *    which turns the sign-in form into an account enumerator. Both now answer
 *    the same 401 with the same body, and a missing user still pays for one
 *    argon2 verify so the response time does not distinguish the cases either.
 * 2. **An inactive account gets no session.** Upstream minted the token, wrote
 *    the session row, then answered 403 — so the "unactivated" user held a
 *    cookie the JWT strategy accepted, and activation was optional in practice.
 *    The check now runs before any token exists.
 * 3. **Signup sends the activation mail.** Upstream created the account and
 *    threw 403 for the caller; nothing was ever sent. Signup now creates the
 *    account inactive, mails the link, and returns 201 — and if the mail cannot
 *    be sent the row is removed again, so no unreachable accounts accumulate.
 * 4. **Activation no longer needs a session.** It reads the emailed token, so it
 *    can be public: requiring a cookie would mean the one account that needs it
 *    cannot authenticate.
 */
@Injectable()
export class AuthService {
  /**
   * Activation-mail ledger keyed by the requested address (audit: mail bomb).
   * Five send attempts per address per sliding hour; earlier expiry is the
   * cleanup, so no sweeper is needed for a bounded map of at most five rows
   * per hour per process.
   */
  private readonly mailBudget = new Map<string, { count: number; first: number }>();

  private claimMailBudget(email: string): boolean {
    const key = email.trim().toLowerCase();
    const now = Date.now();
    const row = this.mailBudget.get(key);
    if (!row || now - row.first > 3_600_000) {
      this.mailBudget.set(key, { count: 1, first: now });
      return true;
    }
    if (row.count >= 5) return false;
    row.count += 1;
    return true;
  }

  private readonly logger = new Logger(AuthService.name);
  /**
   * Verified against when the email is unknown, so a miss costs the same as a
   * wrong password. Built once, on the first miss.
   */
  private dummyHash: string | null = null;

  constructor(
    private userService: UsersService,
    private tokenService: TokensService,
    private jwtService: JwtService,
    private mailerService: MailerService,
    private trustedDeviceService: TrustedDevicesService,
    private configService: ConfigService,
    private readonly tempLinks: TempLinksService,
    @Inject('USLUB_USER_IDENTITIES') private readonly identities: UserIdentitiesRepository,
  ) {}

  getCookieOptions(): CookieOptions {
    const ttl = Number(this.configService.get<string>('COOKIE_JWT_TTL_MS') ?? 604_800_000);
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    return getCookieOptions(isProduction, ttl);
  }

  private async equaliseTiming(password: string): Promise<void> {
    if (!this.dummyHash) {
      this.dummyHash = await argonHash('uslub-timing-equaliser', argonConfig);
    }
    await argonVerify(this.dummyHash, password, argonConfig).catch(() => false);
  }

  async signinLocal(
    signinUser: signinUserDTO,
    fingerprint: FingerprintObj,
  ): Promise<AuthenticatedUser> {
    const { email, password } = signinUser.user;
    const user = await this.userService.getUserByEmail(email, '+password');

    if (!user) {
      await this.equaliseTiming(password);
      // Logged without the address: the failure record must not become a list of
      // which emails exist. The attempt itself is what an operator needs to see.
      this.logger.warn('auth.signin failed reason=unknown_account');
      throw new UnauthorizedException('Invalid email or password');
    }

    const isValidPassword = user.password
      ? await argonVerify(user.password, password, argonConfig)
      : false;
    if (!isValidPassword) {
      // An account created through a provider has no password to be wrong. Saying so
      // is the difference between a dead end and an instruction: the person may have
      // forgotten they signed up with Google, and "invalid password" would never say.
      if (!user.password) {
        const provider = this.identities.listForUser(user.id)[0]?.provider;
        if (provider) {
          this.logger.warn(`auth.signin failed reason=provider_account user=${user.id}`);
          // No provider name in the answer: that 409 drew an
          // account-existence oracle next to the generic 401 (any wrong
          // password would map "provider-linked" accounts to a distinct
          // status + message). Answer exactly like a wrong password; the
          // server-side warning above keeps the operator signal.
          throw new UnauthorizedException('Invalid email or password');
        }
      }
      this.logger.warn(`auth.signin failed reason=bad_password user=${user.id}`);
      throw new UnauthorizedException('Invalid email or password');
    }

    // Before any token is minted: an unactivated account has no session at all.
    if (!user.isActivated) {
      this.logger.warn(`auth.signin failed reason=not_activated user=${user.id}`);
      throw new ForbiddenException('Account not activated yet');
    }
    if (user.status !== 'active') {
      this.logger.warn(`auth.signin failed reason=disabled user=${user.id}`);
      throw new ForbiddenException('Account is disabled');
    }

    // A 2FA-enabled account on an untrusted device gets the minimum grant: a
    // pending token that only /2fa/verify accepts. The full session (and the
    // sessions row) is minted after the code is verified.
    const isDeviceTrusted = await this.trustedDeviceService.isDeviceTrusted(user.id, fingerprint);
    const token =
      user.isTwoFAEnabled && !isDeviceTrusted
        ? await this.generatePendingToken(user)
        : await this.generateAndSaveToken(user, fingerprint);
    // One line per successful sign-in: the audit trail an operator reads after a
    // credential leak, in a format that greps.
    this.logger.log(
      `auth.signin ok user=${user.id} role=${user.role} twofa=${!!user.isTwoFAEnabled}`,
    );
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActivated: !!user.isActivated,
      isTwoFAEnabled: !!user.isTwoFAEnabled,
      token,
    };
  }

  /**
   * Creates the account inactive and mails the activation link. Returns no
   * token: the session starts at activation, which is also the first moment the
   * account is usable.
   */
  async signupLocal(signup: SignupUserDTO): Promise<{ id: number; email: string; name: string }> {
    // The claim gate comes first: an unclaimed instance must not answer
    // "already registered" and must not accumulate unowned accounts.
    this.userService.assertClaimed();
    const { email, password, name } = signup.user;
    const existing = await this.userService.getUserByEmail(email);
    if (existing) {
      // Signup cannot be generic the way sign-in is — the caller must know the
      // address is taken — but it says nothing about the account behind it.
      throw new BadRequestException('This email is already registered');
    }

    const user = await this.userService.create({ email, password, name });
    try {
      await this.mailerService.sendActivationEmail(user);
    } catch (err) {
      // No activation mail means an account nobody can reach. Remove it so the
      // address stays usable, then surface the real cause (503 or 502).
      this.userService.delete(user.id).catch(() => undefined);
      this.logger.error(`signup rollback for ${email}: ${(err as Error).message}`);
      throw err;
    }

    return { id: user.id, email: user.email, name: user.name };
  }

  /** Public: the emailed token is the credential, not a cookie. */
  async activateLocal(
    token: string,
    fingerprint: FingerprintObj,
  ): Promise<{ message: string; token: string; user: AuthenticatedUser }> {
    // The link is single-use and purpose-bound (migration 009; audit:
    // temp-link.replay-no-consumption-cross-flow): only an activation-purpose
    // token whose ledger row is still unconsumed activates, and redemption
    // flips that row so a replayed mail answers invalid. A reset purpose is
    // refused here rather than stripped — one forwarder's link must not
    // become a password-set credential.
    const decoded = await this.tempLinks.verify(token, 'activation');
    const links = this.tempLinks;
    if (!links.consume(decoded.jti, 'activation')) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userService.activate(decoded.id, { isActivated: true });
    links.purgeForUser(user.id, 'activation');
    const sessionToken = await this.generateAndSaveToken(user, fingerprint);

    return {
      message: 'Account activated successfully',
      token: sessionToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActivated: true,
        isTwoFAEnabled: !!user.isTwoFAEnabled,
        token: sessionToken,
      },
    };
  }

  /**
   * Always the same answer, whether the address exists, is already active, or
   * belongs to nobody: the response must not tell a stranger which accounts are
   * waiting to be activated.
   */
  async resendActivationLocal(email: string): Promise<{ message: string }> {
    const generic = { message: 'If that address needs activation, a new link has been sent' };
    const user = await this.userService.getUserByEmail(email);
    if (!user || user.isActivated) {
      return generic;
    }
    // Per-address mail budget, on top of the IP-bucket route throttle (audit:
    // unthrottled mail). Five links per address per hour survives the honest
    // "my link expired" case — and a rotated-IP campaign asking for the same
    // victim's address still lands on this ledger instead of this deployment's
    // transport reputation. In-memory per process, like the 2FA lockout.
    if (!this.claimMailBudget(email)) {
      return generic;
    }
    try {
      await this.mailerService.sendActivationEmail(user);
    } catch (err) {
      this.logger.warn(`resend activation failed for ${email}: ${(err as Error).message}`);
    }
    return generic;
  }

  /**
   * Redeem the link sent to the new address. The token names the target
   * address, so the database is only asked to swap it at the end; a replay
   * loses on `consume`, and an address claimed in the meantime is refused
   * instead of overwritten.
   *
   * Public: the token is the credential. A change of address is a security
   * event, so every session dies and this device re-authenticates with the new
   * address.
   */
  async confirmEmailChange(
    token: string,
    fingerprint: FingerprintObj,
  ): Promise<{ message: string; email: string; token: string }> {
    const decoded = await this.tempLinks.verify(token, 'email_change');
    const newEmail = decoded.email;
    if (!newEmail) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    if (!this.tempLinks.consume(decoded.jti, 'email_change')) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.userService.getUserById(decoded.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const previousEmail = user.email;
    const existing = await this.userService.getUserByEmail(newEmail);
    if (existing && existing.id !== user.id) {
      throw new ConflictException('This email is already registered');
    }

    // Explicit `isActivated: true`: `UsersService.update` deactivates an account
    // whose email changed, because that is the right default for an admin
    // rewrite. A confirmed change is the owner proving the new mailbox, so the
    // account must stay usable.
    const updated = await this.userService.update(user.id, { email: newEmail, isActivated: true });
    this.tempLinks.purgeForUser(user.id, 'email_change');

    // Every session dies: the person re-authenticates with the new address on
    // this device, and any other device is signed out.
    await this.tokenService.deleteAllForUser(user.id);
    const sessionToken = await this.generateAndSaveToken(updated, fingerprint);

    try {
      await this.mailerService.sendEmailChangedNotice({ ...user, email: previousEmail }, newEmail);
    } catch (err) {
      // The change is done; a failed notice must not undo it.
      this.logger.warn(`email-changed notice failed for ${user.id}: ${(err as Error).message}`);
    }

    return { message: 'Email address updated', email: updated.email, token: sessionToken };
  }

  async signout(id: string | number, token: string): Promise<string> {
    await this.tokenService.deleteTokenByValue(token);
    return id.toString();
  }

  /**
   * A cookie token. Its validity comes from `COOKIE_JWT_TTL_MS`, and the row in
   * `sessions` is what the JWT strategy checks — so sign-out, disable and
   * password reset all take effect immediately rather than at expiry.
   */
  async generateToken(user: User, fingerprint: FingerprintObj): Promise<string> {
    const isDeviceTrusted: boolean = await this.trustedDeviceService.isDeviceTrusted(
      user.id,
      fingerprint,
    );
    const tokenPayload: TokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      isActivated: user.isActivated || false,
      isTwoFAEnabled: user.isTwoFAEnabled || false,
      isDeviceTrusted,
      // Two sign-ins in the same second would otherwise sign the same bytes and
      // collide on sessions.token_hash.
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(tokenPayload, {
      secret: this.configService.get<string>('COOKIE_JWT_SECRET'),
      expiresIn: Number(this.configService.get<string>('COOKIE_JWT_TTL_MS') ?? 604_800_000),
    });
  }

  /** Exposed for flows outside this service (OAuth callback) sharing the check. */
  async isDeviceTrustedFor(id: string | number, fingerprint: FingerprintObj): Promise<boolean> {
    return this.trustedDeviceService.isDeviceTrusted(id, fingerprint);
  }

  /**
   * Minimum-grant token for the 430 pending-2FA state. It proves the password
   * was presented and nothing else: the claim `twoFaPending` is rejected by the
   * JWT strategy on every route, so only `POST /2fa/verify` (which carries its
   * own guard) accepts it. Never stored in `sessions` — revocability comes
   * free from the short TTL.
   */
  async generatePendingToken(user: User): Promise<string> {
    const pendingPayload = {
      id: user.id,
      email: user.email,
      role: user.role || 'user',
      isActivated: user.isActivated || false,
      isTwoFAEnabled: true,
      twoFaPending: true,
      jti: randomUUID(),
    };
    return this.jwtService.signAsync(pendingPayload, {
      secret: this.configService.get<string>('COOKIE_JWT_SECRET'),
      expiresIn: Number(this.configService.get<string>('TWOFA_PENDING_TTL_MS') ?? 600_000),
    });
  }

  async generateAndSaveToken(user: User, fingerprint: FingerprintObj): Promise<string> {
    const token = await this.generateToken(user, fingerprint);
    await this.tokenService.updateTokenByFingerprint(user.id, fingerprint, token);
    return token;
  }
}
