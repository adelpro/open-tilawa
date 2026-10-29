import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SeedersService } from '@/seeders/seeders.service';
import { SettingsService } from '@/settings/settings.service';
import { StatusService } from '@/status/status.service';
import { AlertsService } from './alerts.service';
import { evaluate } from './notifications.rules';

/** Enough history to see three failures and two recoveries, plus a margin. */
const CHECK_WINDOW = 20;

/**
 * Reads what the pollers already wrote, and turns it into alerts.
 *
 * The offset matters: `status` and `seeders` both run at minute 0 of every five,
 * so this runs at minute 2 — after their snapshots exist, and before the next
 * round overwrites the story.
 */
@Injectable()
export class NotificationsScheduler implements OnModuleInit {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly status: StatusService,
    private readonly seeders: SeedersService,
    private readonly settings: SettingsService,
    private readonly alerts: AlertsService,
  ) {}

  onModuleInit(): void {
    // A test boot must not evaluate the fleet on a timer.
    if (process.env.NODE_ENV === 'test') return;
    const timer = setTimeout(() => void this.run(), 20_000);
    timer.unref?.();
  }

  @Cron('0 2-59/5 * * * *')
  async run(): Promise<void> {
    try {
      const settings = this.settings.getNotifySettings();
      const events = evaluate({
        now: new Date(),
        services: this.status
          .recentChecks(CHECK_WINDOW)
          .map((service) => ({ id: service.id, name: service.name, passed: service.passed })),
        seeders: this.seeders.list().map((seeder) => ({
          id: seeder.id,
          name: seeder.name,
          status: seeder.status,
          lastSeen: seeder.lastSeen,
          headroomBytes: seeder.headroomBytes,
          updateError: seeder.updateError,
        })),
        open: this.alerts.openKeys(),
        settings: {
          enabled: settings.enabled,
          serviceFailures: settings.serviceFailures,
          diskFloorBytes: settings.diskFloorBytes,
        },
      });
      await this.alerts.apply(events);
    } catch (error) {
      this.logger.warn(`alert pass failed: ${(error as Error).message}`);
    }
  }
}
