import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  ServiceUnavailableException,
  HttpException,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';

import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { InvalidEvent, RETENTION_DAYS, TelemetryService, assertSummaryFilters } from './telemetry.service';

/**
 * Ingest is public on purpose: it carries nothing that identifies anyone, and a listener
 * should not need an account to report that playback broke. The summary is admin-only,
 * because it is the operator's own picture of the fleet.
 */
@Controller()
export class TelemetryController {
  constructor(private readonly telemetry: TelemetryService) {}

  @Post('public/telemetry')
  @HttpCode(HttpStatus.NO_CONTENT)
  ingest(@Body() body: unknown, @Req() request: Request): void {
    if (!this.telemetry.accepted()) throw new ServiceUnavailableException('telemetry is off');
    try {
      this.telemetry.ingest(body, request.ip ?? 'unknown');
    } catch (error) {
      if (error instanceof InvalidEvent) {
        if (error.message === 'rate limited') throw new HttpException('rate limited', 429);
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Get('admin/telemetry/summary')
  @UseGuards(JWTAuthGuard, RoleGuard)
  @Roles('admin')
  summary(
    @Query('days') days?: string,
    @Query('source') source?: string,
    @Query('version') version?: string,
    @Query('reciter') reciter?: string,
  ) {
    const window = Math.max(1, Number.parseInt(days ?? '7', 10) || 7);
    if (window > RETENTION_DAYS) {
      throw new BadRequestException(`the raw window is ${RETENTION_DAYS} days`);
    }
    try {
      return this.telemetry.summary(window, assertSummaryFilters({ source, version, reciter }));
    } catch (error) {
      if (error instanceof InvalidEvent) throw new BadRequestException(error.message);
      throw error;
    }
  }
}
