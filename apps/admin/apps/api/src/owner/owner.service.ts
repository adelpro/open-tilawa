import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { verify as argonVerify } from '@node-rs/argon2';
import { authenticator } from 'otplib';
import { AuditRepository, SessionsRepository, UsersRepository, type User } from '@tilawa-admin/core';
import { argonConfig } from '@/config/argon.config';
import { AuthService } from '@/auth/auth.service';
import { FingerprintObj } from '@/auth/types/fingerprint.type';
import { MailerService } from '@/mailer/mailer.service';
import { TempLinksService } from '@/temp-links/temp-links.service';

/**
 * Ownership transfer.
 *
 * The Owner is the only account that can appoint or remove super admins, so
 * moving the flag is the most consequential account operation in the product.
 * It is deliberately two-step: the Owner proves the password and, when enabled,
 * the second factor; the target must already be an active super_admin; and the
 * flag does not move until the target accepts from their mailbox. Both sides
 * lose every session the moment it moves.
 */
@Injectable()
export class OwnerService {
  private readonly logger = new Logger(OwnerService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly sessions: SessionsRepository,
    private readonly auth: AuthService,
    private readonly mailer: MailerService,
    private readonly links: TempLinksService,
    private readonly audit: AuditRepository,
  ) {}

  async initiate(
    actorId: string | number,
    input: { email: string; password: string; totp?: string },
  ): Promise<{ message: string }> {
    const actor = this.users.getById(Number(actorId));
    if (!actor || !actor.isOwner || actor.status !== 'active') {
      throw new ForbiddenException('Only the Owner can transfer ownership');
    }
    if (!input.email || input.email.toLowerCase() === actor.email.toLowerCase()) {
      throw new BadRequestException('Choose a different account');
    }

    const target = this.users.getByEmail(input.email);
    if (!target || target.role !== 'super_admin' || target.status !== 'active') {
      throw new BadRequestException('The new Owner must be an active super admin');
    }
    if (target.id === actor.id) {
      throw new BadRequestException('Choose a different account');
    }

    const withPassword = this.users.getByEmail(actor.email, true);
    if (!withPassword?.password) {
      throw new BadRequestException('Set a password before transferring ownership');
    }
    const valid = await argonVerify(withPassword.password, input.password, argonConfig);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (withPassword.isTwoFAEnabled) {
      if (!input.totp) throw new BadRequestException('totp is required');
      authenticator.options = { window: 1 };
      if (
        !withPassword.twoFASecrect ||
        !authenticator.verify({ token: input.totp, secret: withPassword.twoFASecrect })
      ) {
        throw new UnauthorizedException('Invalid code');
      }
    }

    // Only the newest invitation is live; an older mailbox cannot complete a
    // transfer the Owner has already replaced.
    this.links.purgeForUser(actor.id, 'owner_transfer');
    try {
      await this.mailer.sendOwnerTransferInvite(withPassword, target);
    } catch (err) {
      this.links.purgeForUser(actor.id, 'owner_transfer');
      throw err;
    }

    this.audit.record({
      actorId: actor.id,
      userId: target.id,
      action: 'owner:transfer_request',
      target: target.email,
      after: { from: actor.email, to: target.email },
    });
    return { message: 'Ownership transfer link sent to the new Owner' };
  }

  async confirm(
    token: string,
    fingerprint: FingerprintObj,
  ): Promise<{
    message: string;
    token: string;
    owner: { id: number; name: string; email: string };
  }> {
    const decoded = await this.links.verify(token, 'owner_transfer');
    const fromId = decoded.fromId;
    const toId = decoded.toId;
    if (!fromId || !toId || Number(decoded.id) !== fromId) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    // Consume before mutating. A replayed link loses here even if the transfer
    // below fails for a stale-state reason.
    if (!this.links.consume(decoded.jti, 'owner_transfer')) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const currentOwner = this.users.getOwner();
    if (!currentOwner || currentOwner.id !== fromId) {
      throw new ConflictException('This transfer is no longer valid');
    }
    const target = this.users.getById(toId);
    if (!target || target.role !== 'super_admin' || target.status !== 'active') {
      throw new ConflictException('The new Owner must be an active super admin');
    }

    const { from, to } = this.users.transferOwner(fromId, toId);

    // Both parties start over: the old Owner must not keep a session that
    // predates the handover, and the new Owner proves possession of the mailbox.
    this.sessions.deleteByUser(from.id);
    this.sessions.deleteByUser(to.id);
    const session = await this.auth.generateAndSaveToken(to, fingerprint);

    // Notifications are best-effort: the transfer already happened, and a mail
    // failure must not make the endpoint look like it did not.
    await this.mailer
      .sendOwnerTransferComplete(to, to.name)
      .catch((err: Error) =>
        this.logger.warn(`owner complete mail to ${to.email}: ${err.message}`),
      );
    await this.mailer
      .sendOwnerTransferComplete(from, to.name)
      .catch((err: Error) =>
        this.logger.warn(`owner complete mail to ${from.email}: ${err.message}`),
      );

    this.audit.record({
      actorId: from.id,
      userId: to.id,
      action: 'owner:transfer_complete',
      target: to.email,
      before: { owner: from.email },
      after: { owner: to.email },
    });

    return {
      message: 'Ownership transferred',
      token: session,
      owner: { id: to.id, name: to.name, email: to.email },
    };
  }

  /** Read-only sanity check for the Account screen and CLI. */
  current(): User | null {
    return this.users.getOwner();
  }
}
