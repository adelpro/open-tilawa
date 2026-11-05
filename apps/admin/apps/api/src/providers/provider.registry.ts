import { BadRequestException, Injectable } from '@nestjs/common';
import { ItqanProvider } from './itqan/itqan.provider';
import { Mp3QuranProvider } from './mp3quran/mp3quran.provider';
import { QuranFoundationProvider } from './quranfoundation/quranfoundation.provider';
import type { ProviderId, ReciterProvider } from './provider.types';

/** The one place a provider id becomes a module. */
@Injectable()
export class ProviderRegistry {
  private readonly providers: Map<ProviderId, ReciterProvider>;

  constructor(
    itqan: ItqanProvider,
    mp3quran: Mp3QuranProvider,
    quranfoundation: QuranFoundationProvider,
  ) {
    this.providers = new Map<ProviderId, ReciterProvider>([
      [itqan.id, itqan],
      [mp3quran.id, mp3quran],
      [quranfoundation.id, quranfoundation],
    ]);
  }

  get(id: string): ReciterProvider {
    const provider = this.providers.get(id as ProviderId);
    if (!provider) throw new BadRequestException(`unknown provider: ${id}`);
    return provider;
  }

  list(): { id: ProviderId; label: string }[] {
    return [...this.providers.values()].map((provider) => ({
      id: provider.id,
      label: provider.label,
    }));
  }
}
