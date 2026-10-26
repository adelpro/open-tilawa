import { Module } from '@nestjs/common';
import { SeedersService } from './seeders.service';
import { SeedersController } from './seeders.controller';

@Module({
  providers: [SeedersService],
  controllers: [SeedersController],
  exports: [SeedersService],
})
export class SeedersModule {}
