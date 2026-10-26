import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersModule } from '../seeders/seeders.module';
import { ToolsController } from './tools.controller';

@Module({
  imports: [UsersModule, SeedersModule],
  controllers: [ToolsController],
})
export class ToolsModule {}
