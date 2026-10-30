import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TelemetryService } from './telemetry.service';

/**
 * The hourly beat telemetry needs, and the reason it is a scheduler rather than a
 * request handler: a table that only rotates when someone opens the console is a
 * ninety-day promise that holds for the operators who look, and fails for everyone else.
 *
 * Two jobs, two `try` blocks. A missing log mount must not stop the prune, and a prune
 * that throws must not hide the volume for another hour.
 */
@Injectable()
export class TelemetryScheduler implements OnModuleInit {
  private readonly logger = new Logger(TelemetryScheduler.name);

  constructor(private readonly telemetry: TelemetryService) {}

  onModuleInit(): void {
    // A test boot must not read a log directory or touch the clock.
    if (process.env.NODE_ENV === 'test') return;
    // First pass after the server is up, not before it listens: the app mounts the
    // media log beside this process and the directory may still be initialising.
    const timer = setTimeout(() => void this.run(), 30_000);
    timer.unref?.();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      this.telemetry.rotate();
    } catch (error) {
      this.logger.warn(`telemetry rotation failed: ${(error as Error).message}`);
    }

    try {
      const imported = this.telemetry.importMediaLog();
      if (imported.files > 0) {
        this.logger.log(
          `telemetry: imported ${imported.rows} media row(s), ${imported.bytes} byte(s) from ${imported.files} file(s)`,
        );
      }
    } catch (error) {
      this.logger.warn(`media log import failed: ${(error as Error).message}`);
    }
  }
}
