import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersService } from './seeders.service';
import { SeedersController } from './seeders.controller';

@Module({
  imports: [UsersModule],
  providers: [SeedersService],
  controllers: [SeedersController],
  exports: [SeedersService],
})
export class SeedersModule {}
