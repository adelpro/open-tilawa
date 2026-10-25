import { Module } from '@nestjs/common';
import { TrustedDevicesService } from './trusted-devices.service';

@Module({
  providers: [TrustedDevicesService],
  exports: [TrustedDevicesService],
})
export class TrustedDevicesModule {}
