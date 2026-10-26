import { TrustedDevicesModule } from '@/trusted-devices/trusted-devices.module';
import { TokensModule } from '@/tokens/tokens.module';
import { UsersModule } from '@/users/users.module';
import { AuthModule } from '@/auth/auth.module';
import { TempLinksModule } from '@/temp-links/temp-links.module';
import { MailerModule } from '@/mailer/mailer.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    JwtModule.register({}),
    UsersModule,
    AuthModule,
    TokensModule,
    TrustedDevicesModule,
    TempLinksModule,
    MailerModule,
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
