import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { verify as argonVerify } from '@node-rs/argon2';
import { FingerprintObj } from '@/auth/types/fingerprint.type';
import { UsersService } from '@/users/users.service';
import { argonConfig } from '@/config/argon.config';
import { TempLinksService } from '@/temp-links/temp-links.service';
import { AuthService } from '@/auth/auth.service';
import { MailerService } from '@/mailer/mailer.service';
import { TokensService } from '@/tokens/tokens.service';

/**
 * The account half of the ported `me.service.ts`.
 *
 * Activation moved to `AuthService`, because it has to be reachable by an
 * account that cannot authenticate yet — see the note there. The image methods
 * stay out until `P6`, where an avatar is actually displayed and can be served
 * from the same origin rather than through a second route family.
 *
 * One behavioural change, and it is the reason a password change exists: **every
 * other session dies** with the old password, and the device that made the
 * change is handed a fresh token. Upstream changed the hash and left every
 * device signed in.
 */
@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(
    private readonly userService: UsersService,
    private readonly tokenService: TokensService,
    private readonly authService: AuthService,
    private readonly tempLinks: TempLinksService,
    private readonly mailerService: MailerService,
  ) {}

  /**
   * Request an email change. The address does not move here: a single-use link
   * goes to the new address and the switch happens when it is opened.
   *
   * The current password is required because this is a session-hijack action:
   * a borrowed cookie must not be able to redirect the account to another
   * mailbox. The response is deliberately the same whether or not the address
   * is taken — an account screen is not an email-availability oracle.
   */
  async updatePassword(
    id: string | number,
    oldPassword: string,
    newPassword: string,
    fingerprint: FingerprintObj,
  ): Promise<{ message: string; token: string }> {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('oldPassword and newPassword are required');
    }
    if (oldPassword === newPassword) {
      throw new BadRequestException('The new password must differ from the old one');
    }

    const user = await this.userService.getUserById(id, '+password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const isValidPassword = user.password
      ? await argonVerify(user.password, oldPassword, argonConfig)
      : false;
    if (!isValidPassword) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const updated = await this.userService.update(id, { password: newPassword });
    // A password change invalidates every still-unspent reset link on the
    // account: they were minted on the old password's authority (migration 009).
    this.tempLinks.purgeForUser(updated.id, 'reset');
    await this.tokenService.deleteAllForUser(id);
    const token = await this.authService.generateAndSaveToken(updated, fingerprint);
    return { message: 'Password updated successfully', token };
  }

  /** Deletion: sessions and trusted devices go with the row, deliberately. */
  async deleteAccount(id: string | number): Promise<{ id: number; email: string }> {
    const user = await this.userService.getUserById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (user.isOwner) {
      throw new ConflictException('Transfer ownership before deleting this account');
    }
    if (user.role === 'super_admin' && this.userService.countActiveSuperAdmins() <= 1) {
      throw new ConflictException('The last active super_admin cannot be deleted');
    }
    await this.tokenService.deleteAllForUser(id);
    await this.userService.delete(id);
    return { id: user.id, email: user.email };
  }
}
