import { Injectable, UnauthorizedException } from '@nestjs/common';
import { TempLinksService } from '@/temp-links/temp-links.service';
import { MailerService } from '@/mailer/mailer.service';
import { TokensService } from '@/tokens/tokens.service';
import { UsersService } from '@/users/users.service';

/**
 * The forgot-password flow: an emailed single-use link is the only proof of
 * identity, and the born rule from the audit trail is that every outward
 * answer is generic until the redemption itself succeeds.
 *
 * Two deliberate behaviours:
 * 1. `sendEmail` answers the same `message` for a known address, an unknown
 *    one, a disabled transport, and a disabled account. A probe who cannot
 *    tell whether `admin@…` exists learns nothing from this route.
 * 2. `validate` consumes the link, then sets the password and flips the
 *    account to activated (owning the mailbox proved more than the
 *    activation email asks), and finally revokes every live session: a
 *    user asking for a reset does not want an old session kept alive.
 *    Outstanding reset links of the same account are purged — the state
 *    they were minted for is gone.
 */
@Injectable()
export class ResetPasswordService {
  constructor(
    private readonly tempLinks: TempLinksService,
    private readonly mailer: MailerService,
    private readonly tokens: TokensService,
    private readonly users: UsersService,
  ) {}

  async sendEmail(email: string): Promise<{ message: string }> {
    const generic = {
      message: 'If that address has an account, a reset link has been sent',
    };

    let user;
    try {
      user = await this.users.getUserByEmail(email);
    } catch {
      return generic;
    }
    if (!user) return generic;

    try {
      await this.mailer.sendResetPasswordEmail({
        id: user.id,
        email: user.email,
        name: user.name,
        locale: user.locale,
      });
    } catch {
      // Same answer as every other outcome: the address (in)existence is the
      // only bit the response may not leak, and mailer failures are visible
      // in the logs either way.
      return generic;
    }
    return generic;
  }

  async validate(token: string, password: string): Promise<{ message: string; email: string }> {
    // Signature + expiry + purpose, then the single-use ledger row: consumed
    // exactly once, atomically, so a replayed mail answers invalid (audit:
    // temp-link.replay-no-consumption-cross-flow).
    const decoded = await this.tempLinks.verify(token, 'reset');
    const consumed = this.tempLinks.consume(decoded.jti, 'reset');
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const user = await this.users.update(Number(decoded.id), {
      password,
      isActivated: true,
    });
    this.tempLinks.purgeForUser(user.id, 'reset');
    await this.tokens.deleteAllForUser(user.id);

    return {
      message: 'Password reset successfully',
      email: user.email,
    };
  }
}
