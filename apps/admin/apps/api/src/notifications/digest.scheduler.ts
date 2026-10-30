import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DigestService } from './digest.service';

/**
 * Ticks every hour and sends at the configured UTC hour.
 *
 * Hourly rather than a single `@Cron('0 8 * * *')` so the hour is a setting the
 * operator owns: a cron expression baked at boot cannot be changed from the
 * console without a restart, which is the whole point of the screen.
 */
@Injectable()
export class DigestScheduler {
  private readonly logger = new Logger(DigestScheduler.name);

  constructor(private readonly digest: DigestService) {}

  @Cron('0 0 * * * *')
  async run(): Promise<void> {
    try {
      const now = new Date();
      const { due, day } = this.digest.due(now);
      if (!due) return;
      const sent = await this.digest.send(day);
      if (sent > 0) this.logger.log(`daily status mail sent to ${sent} recipient(s)`);
    } catch (error) {
      this.logger.warn(`daily status mail failed: ${(error as Error).message}`);
    }
  }
}
