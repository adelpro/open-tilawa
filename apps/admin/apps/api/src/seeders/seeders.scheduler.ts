import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SeedersService } from './seeders.service';

/**
 * Keep the fleet's numbers honest without anyone opening the console.
 *
 * The seeder rows are a snapshot: torrent count, disk, version, and now the
 * inventory behind every placement. Before this scheduler existed they were only
 * refreshed when an operator happened to act on a node, so the console showed
 * "22 torrents · 32.7 GB" for a node holding three.
 */
@Injectable()
export class SeedersScheduler implements OnModuleInit {
  private readonly logger = new Logger(SeedersScheduler.name);

  constructor(private readonly seeders: SeedersService) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    // After the HTTP server binds: polling at boot would race our own start-up.
    const timer = setTimeout(() => void this.poll(), 15_000);
    timer.unref?.();
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async poll(): Promise<void> {
    try {
      await this.seeders.pollAll();
    } catch (error) {
      this.logger.warn(`seeder poll failed: ${(error as Error).message}`);
    }
  }

  /**
   * A pending placement that never landed must become a failure. Every five
   * minutes is enough: the TTL is three hours, so precision costs nothing.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  expire(): void {
    try {
      const expired = this.seeders.expirePlacements();
      if (expired > 0) this.logger.log(`expired ${expired} pending placement(s)`);
    } catch (error) {
      this.logger.warn(`placement expiry failed: ${(error as Error).message}`);
    }
  }
}
