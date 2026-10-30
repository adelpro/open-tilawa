import { Controller, Get, Query } from '@nestjs/common';
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
  list(
    @Query('page') page?: string,
    @Query('range') range?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);
    const limitNum = Math.max(1, parseInt(range ?? limit ?? '10', 10) || 10);
    const offset = (pageNum - 1) * limitNum;

    const { reciters, total } = this.reciters.listPublishedPaginated(offset, limitNum);

    return {
      reciters: reciters.map((reciter) => ({
        id: reciter.id,
        name: reciter.name,
        nameAr: reciter.nameAr,
        riwaya: reciter.riwaya,
        slug: reciter.slug,
        infohash: reciter.infohash,
        magnet: reciter.magnet,
        sizeBytes: reciter.sizeBytes,
        fileCount: reciter.fileCount,
      })),
      total,
      page: pageNum,
      range: limitNum,
    };
  }
}
