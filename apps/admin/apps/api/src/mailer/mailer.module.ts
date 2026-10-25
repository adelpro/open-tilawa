import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TempLinksModule } from '@/temp-links/temp-links.module';
import { MailerService } from './mailer.service';
import { MAIL_TRANSPORT } from './mailer.types';
import { createMailTransport } from './mailer.transport';

/**
 * One mailer for the process.
 *
 * The ported layout listed `MailerService` as a provider in four feature
 * modules, which built four instances — and, once the transporter became a
 * dependency, would have opened four SMTP pools. A single module owns both the
 * service and the transport so a test can override the transport in one place.
 *
 * `JwtModule` is here because the activation and reset links are signed here;
 * the service signs with `TEMP_JWT_SECRET` explicitly rather than relying on a
 * module-wide default.
 */
@Module({
  imports: [JwtModule.register({}), TempLinksModule],
  providers: [
    MailerService,
    {
      provide: MAIL_TRANSPORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        createMailTransport(config, {
          warn: (message: string) => new Logger('MailerTransport').warn(message),
        }),
    },
  ],
  exports: [MailerService, MAIL_TRANSPORT],
})
export class MailerModule {}
