import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SettingsService } from './settings.service';
import { NotificationSettingsController } from './notification-settings.controller';

/**
 * The console's settings service, provided once.
 *
 * It used to be a provider inside `RecitersModule`, because the tracker list is
 * the first thing it owned. Mail configuration and alert thresholds are not
 * reciter concerns, so the service moved here and the reciter module imports it
 * — one instance, one table, no second copy to drift.
 *
 * The mail controller lives in `MailerModule` instead: it needs the mailer, and
 * `MailerModule` already imports this module, so putting it here would close a
 * provider cycle.
 */
@Module({
  imports: [UsersModule],
  controllers: [NotificationSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
