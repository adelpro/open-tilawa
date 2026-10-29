import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersModule } from '../seeders/seeders.module';
import { TurnsModule } from '../turns/turns.module';
import { StatusController } from './status.controller';
import { StatusService } from './status.service';
import { StatusScheduler } from './status.scheduler';

@Module({
  imports: [UsersModule, SeedersModule, TurnsModule],
  controllers: [StatusController],
  providers: [StatusService, StatusScheduler],
  exports: [StatusService],
})
export class StatusModule {}
