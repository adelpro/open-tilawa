import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TempLinksModule } from '@/temp-links/temp-links.module';
import { SettingsModule } from '@/settings/settings.module';
import { SettingsService } from '@/settings/settings.service';
import { ConfiguredMailTransport } from './configured.transport';
import { MailerService } from './mailer.service';
import { MAIL_TRANSPORT } from './mailer.types';

/**
 * One mailer for the process.
 *
 * The ported layout listed `MailerService` as a provider in four feature
 * modules, which built four instances — and, once the transporter became a
 * dependency, would have opened four SMTP pools. A single module owns both the
 * service and the transport so a test can override the transport in one place.
 *
 * The transport is now a facade over the console settings rather than a
 * boot-time decision: `MAIL_TRANSPORT` used to be a `nodemailer` client built
 * from `EMAIL`/`EMAIL_APP_SPECIFIC_PASS` at start-up, which meant changing a
 * credential required recreating the container.
 *
 * `JwtModule` is here because the activation and reset links are signed here;
 * the service signs with `TEMP_JWT_SECRET` explicitly rather than relying on a
 * module-wide default.
 */
@Module({
  imports: [JwtModule.register({}), TempLinksModule, SettingsModule],
  providers: [
    MailerService,
    {
      provide: MAIL_TRANSPORT,
      inject: [SettingsService, ConfigService],
      useFactory: (settings: SettingsService, config: ConfigService) =>
        new ConfiguredMailTransport(settings, {
          email: config.get<string>('EMAIL') || undefined,
          pass: config.get<string>('EMAIL_APP_SPECIFIC_PASS') || undefined,
        }),
    },
  ],
  exports: [MailerService, MAIL_TRANSPORT],
})
export class MailerModule {
  private readonly logger = new Logger(MailerModule.name);

  constructor(sections: SettingsService) {
    const config = sections.getMailConfig();
    if (!config.host && !process.env.EMAIL) {
      this.logger.warn(
        'mail transport disabled — configure it in the console at /console/settings, or set EMAIL and EMAIL_APP_SPECIFIC_PASS for the setup token',
      );
    }
  }
}
