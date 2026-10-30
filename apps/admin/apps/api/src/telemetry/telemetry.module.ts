import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { TelemetryController } from './telemetry.controller';
import { TelemetryScheduler } from './telemetry.scheduler';
import { TelemetryService } from './telemetry.service';

/** Ingest and its summary; the tables live in migration 021 and 022. */
@Module({
  // RoleGuard resolves UsersService; without the import the whole app fails to boot.
  imports: [UsersModule],
  controllers: [TelemetryController],
  providers: [TelemetryService, TelemetryScheduler],
  exports: [TelemetryService],
})
export class TelemetryModule {}
