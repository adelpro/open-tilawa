import { JwtStrategy } from './strategies/jwt.strategy';
import { TrustedDevicesModule } from '@/trusted-devices/trusted-devices.module';
import { MailerModule } from '../mailer/mailer.module';
import { TokensModule } from '../tokens/tokens.module';
import { UsersModule } from '../users/users.module';
import { TempLinksModule } from '@/temp-links/temp-links.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ResetPasswordController } from './reset-password.controller';
import { ResetPasswordService } from './reset-password.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

/**
 * Social sign-in (Google / GitHub / Facebook) is deliberately absent for now:
 * those strategies need OAuth apps, and their new-user path mails a generated
 * password, so they land together with the mailer wiring in P5. Restoring them
 * means adding the strategies back, plus `@nestjs/passport` strategy deps.
 */
@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    TokensModule,
    TrustedDevicesModule,
    MailerModule,
    TempLinksModule,
  ],
  controllers: [AuthController, ResetPasswordController],
  providers: [AuthService, ResetPasswordService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
