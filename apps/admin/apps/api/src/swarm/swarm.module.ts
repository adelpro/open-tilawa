import { Module } from '@nestjs/common';

import { SwarmScheduler } from './swarm.scheduler';
import { SwarmService } from './swarm.service';

/**
 * The table lives in migration 032. `StoreModule` is global, so the service
 * reaches the database without an import here — the same arrangement telemetry
 * uses.
 */
@Module({
  providers: [SwarmService, SwarmScheduler],
  exports: [SwarmService],
})
export class SwarmModule {}
