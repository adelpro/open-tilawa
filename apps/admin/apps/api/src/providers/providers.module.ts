import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { ItqanProvider } from './itqan/itqan.provider';
import { Mp3QuranProvider } from './mp3quran/mp3quran.provider';
import { QuranFoundationProvider } from './quranfoundation/quranfoundation.provider';
import { ProviderRegistry } from './provider.registry';
import { ProvidersController } from './providers.controller';

/**
 * Providers are a read-only view of somebody else's catalogue. Nothing here
 * writes; the reciter module decides what to do with an answer.
 */
@Module({
  imports: [UsersModule],
  controllers: [ProvidersController],
  providers: [ItqanProvider, Mp3QuranProvider, QuranFoundationProvider, ProviderRegistry],
  exports: [ProviderRegistry],
})
export class ProvidersModule {}
