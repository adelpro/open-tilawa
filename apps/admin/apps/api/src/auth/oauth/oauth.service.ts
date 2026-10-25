import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User, UserIdentitiesRepository } from '@tilawa-admin/core';
import { UsersService } from '../../users/users.service';
import type { OAuthIdentity } from './oauth.client';
import { configuredProviders, type OAuthProviderName } from './oauth.config';

/** Where a provider sign-in can end. Each maps to a redirect the SPA can explain. */
export type OAuthFailure =
  | 'provider_disabled'
  | 'state_invalid'
  | 'unverified_email'
  | 'account_exists'
  | 'identity_taken'
  | 'account_disabled'
  | 'not_linked'
  | 'provider_error';

export class OAuthFlowError extends Error {
  constructor(
    readonly code: OAuthFailure,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Turning a provider identity into a session — and refusing to turn it into someone
 * else's session.
 *
 * Upstream `nextpalestine` matches on the email alone and creates the account when
 * nothing matches. That is one line shorter and two holes wide:
 *
 *  - matching on email merges a provider identity into an existing local account, so
 *    whoever controls the provider address inherits the account;
 *  - it accepts whatever address the provider returns, including an unverified one.
 *
 * Here the rules are explicit: verified address or nothing, an existing account is
 * never merged silently, and linking happens only from inside a session whose user id
 * came from the signed state cookie.
 */
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly users: UsersService,
    private readonly config: ConfigService,
    @Inject('USLUB_USER_IDENTITIES') private readonly identities: UserIdentitiesRepository,
  ) {}

  /**
   * Resolve the identity to an account, creating or linking only where that is safe.
   *
   * `linkUserId` is present only when the flow started from a signed-in session, and
   * comes from a signed cookie — never from a query parameter.
   */
  async resolveAccount(
    identity: OAuthIdentity,
    options: { linkUserId?: number } = {},
  ): Promise<User> {
    if (!identity.emailVerified) {
      throw new OAuthFlowError(
        'unverified_email',
        `${identity.provider} did not confirm that address, so it cannot be trusted to identify an account`,
      );
    }

    const existing = this.identities.findByProviderSubject(identity.provider, identity.subject);

    if (existing) {
      if (options.linkUserId && existing.userId !== options.linkUserId) {
        // The provider account is already attached elsewhere. Signing in as its owner
        // would be wrong, and moving the link would be a takeover.
        throw new OAuthFlowError(
          'identity_taken',
          `that ${identity.provider} account is already connected to another Uslub account`,
        );
      }
      const user = await this.users.findById(existing.userId);
      if (!user) throw new OAuthFlowError('provider_error', 'the linked account no longer exists');
      if (user.status !== 'active') {
        throw new OAuthFlowError('account_disabled', 'this account is disabled');
      }
      return user;
    }

    if (options.linkUserId) {
      const user = await this.users.findById(options.linkUserId);
      if (!user) {
        throw new OAuthFlowError('provider_error', 'the signed-in account no longer exists');
      }
      this.identities.link({
        userId: user.id,
        provider: identity.provider,
        subject: identity.subject,
        email: identity.email,
      });
      this.logger.log(`auth.oauth linked provider=${identity.provider} user=${user.id}`);
      return user;
    }

    const byEmail = await this.users.getUserByEmail(identity.email);
    if (byEmail) {
      // Deliberately not a merge. The address matches, but nothing has proven that the
      // person holding it now is the person who set the password then.
      throw new OAuthFlowError(
        'account_exists',
        `an account with ${identity.email} already exists — sign in, then connect ${identity.provider} from Account`,
      );
    }

    const created = await this.users.create({
      name: identity.name,
      email: identity.email,
      // No password at all: this account signs in with the provider until the owner
      // sets one from Account. A generated password emailed in plaintext is how the
      // upstream implementation created a second, weaker credential nobody asked for.
      // The provider already asserted the address, so there is no activation step.
    });

    this.identities.link({
      userId: created.id,
      provider: identity.provider,
      subject: identity.subject,
      email: identity.email,
    });
    this.logger.log(`auth.oauth created provider=${identity.provider} user=${created.id}`);

    return created;
  }

  /** Configured providers, for the sign-in screen. */
  available(): OAuthProviderName[] {
    return configuredProviders((key) => this.config.get<string>(key));
  }

  /**
   * Unlink, but never into a lockout.
   *
   * Removing the last way in would strand the account: no password, no identity, and a
   * reset link nobody can act on. The refusal names the way out, which is to set a
   * password first.
   */
  async unlink(userId: number, provider: OAuthProviderName): Promise<void> {
    const user = await this.users.findById(userId);
    if (!user) throw new OAuthFlowError('provider_error', 'account not found');

    // Disconnecting something that was never connected is a mistake worth naming: the
    // caller has the wrong provider or the wrong account, and a silent 200 hides both.
    if (!this.identities.findForUser(userId, provider)) {
      throw new OAuthFlowError('not_linked', `${provider} is not connected to this account`);
    }

    const others = this.identities
      .listForUser(userId)
      .filter((entry) => entry.provider !== provider);
    const stored = await this.users.getUserByEmail(user.email, '+password');
    const hasPassword = Boolean(stored?.password);

    if (others.length === 0 && !hasPassword) {
      throw new OAuthFlowError(
        'account_exists',
        'this is the only way into the account — set a password from Account before disconnecting it',
      );
    }

    this.identities.unlink(userId, provider);
    this.logger.log(`auth.oauth unlinked provider=${provider} user=${userId}`);
  }
}
