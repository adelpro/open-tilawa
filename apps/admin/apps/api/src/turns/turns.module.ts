import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { UsersModule } from '@/users/users.module';
import { TurnsService } from './turns.service';
import { TurnsScheduler } from './turns.scheduler';
import { TurnsController } from './turns.controller';

@Module({
  imports: [UsersModule, ScheduleModule.forRoot()],
  providers: [TurnsService, TurnsScheduler],
  controllers: [TurnsController],
  exports: [TurnsService],
})
export class TurnsModule {}
