import { Body, Controller, Get, HttpCode, HttpStatus, Put, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { RoleGuard } from '@/auth/guards/roles.guard';
import { SettingsService } from './settings.service';
import type { NotifySettings } from './settings.service';

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
  constructor(private readonly settings: SettingsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Alert rules and extra recipients' })
  read() {
    return this.settings.getNotifySettings();
  }

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save alert rules and extra recipients' })
  save(@Body() body: Partial<NotifySettings>) {
    return this.settings.setNotifySettings(body ?? {});
  }
}
