import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '@/auth/auth.module';
import { TrustedDevicesModule } from '@/trusted-devices/trusted-devices.module';
import { UsersModule } from '@/users/users.module';
import { TokensModule } from '@/tokens/tokens.module';
import { MailerModule } from '@/mailer/mailer.module';
import { TwoFaController } from './two-fa.controller';
import { TwoFaService } from './two-fa.service';

@Module({
  imports: [
    JwtModule.register({}),
    AuthModule,
    UsersModule,
    TokensModule,
    TrustedDevicesModule,
    MailerModule,
  ],
  controllers: [TwoFaController],
  providers: [TwoFaService],
})
export class TwoFaModule {}
