import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { MailerModule } from '@/mailer/mailer.module';
import { SeedersModule } from '@/seeders/seeders.module';
import { SettingsModule } from '@/settings/settings.module';
import { StatusModule } from '@/status/status.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { NotificationsScheduler } from './notifications.scheduler';

/**
 * The alerting stack: reads the pollers' snapshots, evaluates the pure rules, and
 * mails the transitions through the console-configured transport.
 */
@Module({
  imports: [UsersModule, MailerModule, SeedersModule, SettingsModule, StatusModule],
  controllers: [AlertsController],
  providers: [AlertsService, NotificationsScheduler],
  exports: [AlertsService],
})
export class NotificationsModule {}
