import { Controller, Get, HttpCode, HttpStatus, Query, UseGuards } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { RoleGuard } from '@/auth/guards/roles.guard';
import { AlertsService } from './alerts.service';

/**
 * The recent alert history, including the ones that resolved and the ones whose
 * mail failed. A settings screen that only shows the configuration cannot tell
 * an operator whether the rules have ever fired.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recent alerts, newest first' })
  list(@Query('limit') limit?: string) {
    const parsed = Math.trunc(Number(limit ?? 20));
    // `LIMIT 2.5` is a datatype mismatch in SQLite, i.e. a 500 from a query string.
    return this.alerts.recent(Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 20);
  }
}
