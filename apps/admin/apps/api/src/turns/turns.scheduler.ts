import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TurnsService } from './turns.service';

/**
 * The turn probe runs on its own: nobody should have to remember to press
 * "check" to learn a node went down. Every five minutes each registered server
 * gets one STUN binding probe; the outcome and its latency land in the history
 * the dashboard renders.
 */
@Injectable()
export class TurnsScheduler {
  private readonly logger = new Logger(TurnsScheduler.name);

  constructor(private readonly turns: TurnsService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async probe(): Promise<void> {
    try {
      await this.turns.runChecks();
    } catch (err) {
      // A scheduler exception annoys nobody; a swallowed log line hides an outage.
      this.logger.warn(`turn probe pass failed: ${(err as Error).message}`);
    }
  }
}
