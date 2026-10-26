import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SeedersService } from './seeders.service';

/**
 * Seeder nodes and the torrent operations the dashboard runs against them.
 *
 * The torrent verbs are a proxy: credentials live on the seeder row, the call is
 * made server-side, and the browser never holds a seeder password.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('seeders')
export class SeedersController {
  constructor(private readonly service: SeedersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Body()
    body: {
      name: string;
      url: string;
      adminUser?: string;
      adminPass?: string;
    },
  ) {
    try {
      return this.service.add({
        name: body.name,
        url: body.url,
        adminUser: body.adminUser,
        adminPass: body.adminPass,
      });
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      url?: string;
      adminUser?: string | null;
      adminPass?: string | null;
    },
  ) {
    let updated;
    try {
      updated = this.service.update(Number(id), body);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (!updated) throw new NotFoundException('seeder not found');
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.service.remove(Number(id));
  }

  @Post(':id/poll')
  poll(@Param('id') id: string) {
    return this.service.poll(Number(id));
  }

  @Post('poll-all')
  pollAll() {
    return this.service.pollAll();
  }

  // ---------- torrent inventory, proxied to the seeder's Basic-auth admin API ----------

  @Get(':id/torrents')
  torrents(@Param('id') id: string) {
    return this.service.inventory(Number(id));
  }

  @Post(':id/torrents')
  @HttpCode(HttpStatus.CREATED)
  addTorrent(@Param('id') id: string, @Body() body: { magnet?: string; torrentPath?: string }) {
    return this.service.addTorrent(Number(id), body);
  }

  @Delete(':id/torrents/:infoHash')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeTorrent(@Param('id') id: string, @Param('infoHash') infoHash: string) {
    await this.service.removeTorrent(Number(id), infoHash);
  }

  @Get(':id/files')
  async files(@Param('id') id: string) {
    return { files: await this.service.files(Number(id)) };
  }
}
