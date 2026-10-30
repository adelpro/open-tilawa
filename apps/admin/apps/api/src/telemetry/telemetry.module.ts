import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';

import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

/** Ingest and its summary; the table lives in migration 021. */
@Module({
  // RoleGuard resolves UsersService; without the import the whole app fails to boot.
  imports: [UsersModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
