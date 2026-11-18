import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';

import { BackupTargetsController } from './backup-targets.controller';
import { BackupTargetsService } from './backup-targets.service';
import { BridgeClient } from './bridge.client';

@Module({
  imports: [UsersModule],
  controllers: [BackupTargetsController],
  providers: [BackupTargetsService, BridgeClient],
})
export class BackupTargetsModule {}
