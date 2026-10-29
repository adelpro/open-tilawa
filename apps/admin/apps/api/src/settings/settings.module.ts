import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * The console's settings service, provided once.
 *
 * It used to be a provider inside `RecitersModule`, because the tracker list is
 * the first thing it owned. Mail configuration and alert thresholds are not
 * reciter concerns, so the service moved here and the reciter module imports it
 * — one instance, one table, no second copy to drift.
 */
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
