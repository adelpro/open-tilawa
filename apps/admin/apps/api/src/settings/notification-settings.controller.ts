import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { AuditRepository } from '@tilawa-admin/core';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import type { AuthenticatedUser } from '@/auth/types/authenticatedUser.type';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { RoleGuard } from '@/auth/guards/roles.guard';
import { SettingsService } from './settings.service';
import type { NotifyDigest, NotifySettings } from './settings.service';

/**
 * Which alerts are sent, and to whom.
 *
 * Thresholds are configuration, not code: the disk floor and the failure count
 * depend on the fleet's size, and an operator should not need a deploy to move
 * them.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('settings/notifications')
export class NotificationSettingsController {
  constructor(
    private readonly settings: SettingsService,
    @Inject(AuditRepository) private readonly audit: AuditRepository,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alert rules and extra recipients' })
  read() {
    return { ...this.settings.getNotifySettings(), digest: this.settings.getNotifyDigest() };
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save alert rules and extra recipients' })
  save(
    @Body() body: Partial<NotifySettings> & { digest?: Partial<NotifyDigest> },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const saved = this.settings.setNotifySettings(body ?? {});
    const digest = body?.digest
      ? this.settings.setNotifyDigest(body.digest)
      : this.settings.getNotifyDigest();
    // An admin who adds an address here silently copies every future alert —
    // service hostnames, disk state, update errors — to that mailbox.
    this.audit.record({
      actorId: Number(user.id),
      action: 'settings.notifications.updated',
      after: { ...saved, digest },
    });
    return { ...saved, digest };
  }
}
