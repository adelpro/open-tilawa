import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatusService } from './status.service';

/**
 * The status page is only useful if it is checked without anyone opening it.
 * Five minutes, same beat as the TURN probe; the first pass runs at boot so a
 * restart does not leave the page blank for five minutes.
 */
@Injectable()
export class StatusScheduler implements OnModuleInit {
  private readonly logger = new Logger(StatusScheduler.name);

  constructor(private readonly status: StatusService) {}

  onModuleInit(): void {
    // A test boot must not call the public internet for six services.
    if (process.env.NODE_ENV === 'test') return;
    // onModuleInit runs before the HTTP server listens, so an immediate check
    // would report our own API down on every deploy.
    const timer = setTimeout(() => void this.run(), 10_000);
    timer.unref?.();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      await this.status.runAll();
    } catch (err) {
      this.logger.warn(`status pass failed: ${(err as Error).message}`);
    }
  }
}
