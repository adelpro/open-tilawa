import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersService } from './seeders.service';
import { SeedersController } from './seeders.controller';
import { SeedersScheduler } from './seeders.scheduler';

@Module({
  imports: [UsersModule],
  providers: [SeedersService, SeedersScheduler],
  controllers: [SeedersController],
  exports: [SeedersService],
})
export class SeedersModule {}
