import { Controller, Get } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SetupService } from './setup/setup.service';

const startedAt = Date.now();

/**
 * The version the artefact was stamped with.
 *
 * The package version is the only source of truth: an `APP_VERSION` override sat
 * in `.env` and made `/health` claim 0.1.0 for every release, which is precisely
 * the question the field exists to answer. In `src` and in `dist` the API's own
 * package.json sits one directory up, so this reads the same file in tests and
 * in the image.
 */
function packageVersion(): string {
  try {
    const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

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
      service: 'tilawa-admin-api',
      version: packageVersion(),
      sha: process.env.BUILD_SHA ?? 'dev',
      uptimeMs: Date.now() - startedAt,
      dbPath: process.env.DB_PATH ?? null,
      setupRequired: this.setup.setupRequired(),
    };
  }
}
