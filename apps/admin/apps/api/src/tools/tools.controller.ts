import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { magnetFor, torrentInfo } from './bencode';
import { SeedersService } from '../seeders/seeders.service';

/**
 * Two conversions an operator needs around releases:
 *
 * - a `.torrent` file to its infohash and magnet (no network, no node);
 * - a magnet to its name, size and file count, resolved by a seeder node —
 *   metadata lives in the swarm, so the node is the only place that can answer
 *   without downloading the payload itself.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('tools')
export class ToolsController {
  constructor(private readonly seeders: SeedersService) {}

  @Post('torrent-info')
  torrentInfo(@Body() body: { fileBase64: string }) {
    if (!body?.fileBase64) throw new BadRequestException('fileBase64 is required');
    let file: Buffer;
    try {
      file = Buffer.from(body.fileBase64, 'base64');
    } catch {
      throw new BadRequestException('fileBase64 is not valid base64');
    }
    if (file.length === 0) throw new BadRequestException('the uploaded file is empty');
    try {
      return torrentInfo(file);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Post('magnet-info')
  async magnetInfo(@Body() body: { seederId: number; magnet: string }) {
    const magnet = body?.magnet?.trim();
    if (!magnet?.startsWith('magnet:')) {
      throw new BadRequestException('a magnet: URI is required');
    }
    return this.seeders.metadata(Number(body.seederId), magnet);
  }

  /** Build a magnet from an infohash alone (for a catalogue row with no magnet). */
  @Post('magnet')
  build(@Body() body: { infoHash: string; name?: string }) {
    const infoHash = body?.infoHash?.trim();
    if (!infoHash || !/^[0-9a-zA-Z]{32,40}$/.test(infoHash)) {
      throw new BadRequestException('a valid infohash is required');
    }
    return { magnet: magnetFor(infoHash, body.name?.trim() || infoHash) };
  }
}
