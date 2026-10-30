import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { MailerModule } from '@/mailer/mailer.module';
import { SeedersModule } from '@/seeders/seeders.module';
import { SettingsModule } from '@/settings/settings.module';
import { StatusModule } from '@/status/status.module';
import { TurnsModule } from '@/turns/turns.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { NotificationsScheduler } from './notifications.scheduler';
import { DigestScheduler } from './digest.scheduler';
import { DigestService } from './digest.service';

/**
 * The alerting stack: reads the pollers' snapshots, evaluates the pure rules, and
 * mails the transitions through the console-configured transport.
 */
@Module({
  imports: [UsersModule, MailerModule, SeedersModule, SettingsModule, StatusModule, TurnsModule],
  controllers: [AlertsController],
  providers: [AlertsService, NotificationsScheduler, DigestService, DigestScheduler],
  exports: [AlertsService],
})
export class NotificationsModule {}
