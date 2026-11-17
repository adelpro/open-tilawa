import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { SwarmService } from './swarm.service';

/**
 * The hourly question, asked whether or not anyone opened the console.
 *
 * A number that only moves when an operator looks is the same trap the telemetry
 * rotation avoided: the surface is honest for the people who check, and stale for
 * everyone else — including every volunteer reading the extension.
 */
@Injectable()
export class SwarmScheduler implements OnModuleInit {
  private readonly logger = new Logger(SwarmScheduler.name);

  constructor(private readonly swarm: SwarmService) {}

  onModuleInit(): void {
    // A test boot must not reach the network.
    if (process.env.NODE_ENV === 'test') return;
    // First sample after the server listens: a boot that waits on the tracker is
    // a boot that fails when the tracker is down.
    const timer = setTimeout(() => void this.run(), 45_000);
    timer.unref?.();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      const sampled = await this.swarm.sample();
      if (sampled === 0) this.logger.debug('swarm: nothing published to sample');
    } catch (error) {
      // One missed hour is not an outage; the last answer stays until it is stale.
      this.logger.warn(`swarm sample failed: ${(error as Error).message}`);
    }
  }
}
