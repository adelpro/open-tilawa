import { Controller, Get } from '@nestjs/common';
import { SetupService } from './setup/setup.service';

const startedAt = Date.now();

/**
 * Open, unauthenticated readiness endpoint. Reports enough to answer
 * "is the running artefact the one I just built?" without leaking anything.
 * `setupRequired` is a boolean only: a visible super-admin count would be a
 * reconnaissance aid, so we never expose one.
 */
@Controller('health')
export class HealthController {
  constructor(private readonly setup: SetupService) {}

  @Get()
  health(): Record<string, unknown> {
    return {
      status: 'ok',
      service: 'uslub-api',
      version: process.env.APP_VERSION ?? '0.1.0',
      sha: process.env.BUILD_SHA ?? 'dev',
      uptimeMs: Date.now() - startedAt,
      dbPath: process.env.DB_PATH ?? null,
      setupRequired: this.setup.setupRequired(),
    };
  }
}
