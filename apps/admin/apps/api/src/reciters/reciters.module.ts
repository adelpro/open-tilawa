import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersModule } from '../seeders/seeders.module';
import { RecitersController } from './reciters.controller';
import { RecitersService } from './reciters.service';
import { CataloguePushService } from './catalogue-push.service';
import { SettingsController } from '../settings/settings.controller';
import { SettingsService } from '../settings/settings.service';

@Module({
  imports: [UsersModule, SeedersModule],
  controllers: [RecitersController, SettingsController],
  providers: [RecitersService, CataloguePushService, SettingsService],
  exports: [RecitersService],
})
export class RecitersModule {}
