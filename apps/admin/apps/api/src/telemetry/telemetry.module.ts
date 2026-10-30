import { Module } from '@nestjs/common';

import { TelemetryController } from './telemetry.controller';
import { TelemetryService } from './telemetry.service';

/** Ingest and its summary; the table lives in migration 021. */
@Module({
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
