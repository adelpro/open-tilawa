import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SettingsModule } from '@/settings/settings.module';
import { SeedersModule } from '../seeders/seeders.module';
import { ProvidersModule } from '../providers/providers.module';
import { LinkSuggestionsService } from '../providers/link-suggestions.service';
import { RecitersController } from './reciters.controller';
import { RecitersService } from './reciters.service';
import { ReciterImportService } from './reciter-import.service';
import { CataloguePushService } from './catalogue-push.service';
import { SettingsController } from '../settings/settings.controller';
import { PublicRecitersController } from './public-reciters.controller';

/**
 * `SettingsService` arrives from `SettingsModule`: the tracker list is still this
 * module's concern, but the service also owns mail and alert configuration now,
 * and a second provider instance would be a second thing to keep in step.
 */
@Module({
  imports: [UsersModule, SeedersModule, SettingsModule, ProvidersModule],
  controllers: [RecitersController, SettingsController, PublicRecitersController],
  providers: [RecitersService, ReciterImportService, CataloguePushService, LinkSuggestionsService],
  exports: [RecitersService],
})
export class RecitersModule {}
