import { Controller, Get } from '@nestjs/common';
import { RecitersService } from './reciters.service';

/**
 * The catalogue, for the public site.
 *
 * Read-only and unauthenticated by design: the public player needs the magnets
 * to announce, and a magnet is public information (it is what listeners already
 * carry). Only the fields the player uses are exposed — no ids of accounts, no
 * audit, nothing about nodes.
 */
@Controller('public')
export class PublicRecitersController {
  constructor(private readonly reciters: RecitersService) {}

  @Get('reciters')
  list() {
    return {
      reciters: this.reciters.listPublished().map((reciter) => ({
        id: reciter.id,
        name: reciter.name,
        nameAr: reciter.nameAr,
        riwaya: reciter.riwaya,
        infohash: reciter.infohash,
        magnet: reciter.magnet,
        sizeBytes: reciter.sizeBytes,
        fileCount: reciter.fileCount,
      })),
    };
  }
}
