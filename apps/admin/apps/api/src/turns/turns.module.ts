import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { TurnsService } from './turns.service';
import { TurnsScheduler } from './turns.scheduler';
import { TurnsController } from './turns.controller';

@Module({
  imports: [UsersModule],
  providers: [TurnsService, TurnsScheduler],
  controllers: [TurnsController],
  exports: [TurnsService],
})
export class TurnsModule {}
