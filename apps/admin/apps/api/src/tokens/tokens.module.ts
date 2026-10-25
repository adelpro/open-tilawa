import { Module } from '@nestjs/common';
import { TrustedDevicesModule } from '@/trusted-devices/trusted-devices.module';
import { TokensController } from './tokens.controller';
import { TokensService } from './tokens.service';

@Module({
  imports: [TrustedDevicesModule],
  providers: [TokensService],
  exports: [TokensService],
  controllers: [TokensController],
})
export class TokensModule {}
