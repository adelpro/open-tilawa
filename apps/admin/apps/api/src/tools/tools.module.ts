import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersModule } from '../seeders/seeders.module';
import { ToolsController } from './tools.controller';
import { SettingsService } from '../settings/settings.service';

@Module({
  imports: [UsersModule, SeedersModule],
  controllers: [ToolsController],
  providers: [SettingsService],
})
export class ToolsModule {}
