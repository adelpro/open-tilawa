import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { SettingsService } from './settings.service';
import { RecitersService } from '../reciters/reciters.service';

/**
 * The tracker list, and the catalogue rewrite it implies.
 *
 * Saving a new list rebuilds every stored reciter magnet from its infohash and
 * name, because a magnet is derived data: leaving old rows on the old list would
 * mean two different announce sets depending on when a reciter was added.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly reciters: RecitersService,
  ) {}

  @Get('trackers')
  getTrackers() {
    return { trackers: this.settings.getTrackers() };
  }

  @Put('trackers')
  setTrackers(@Body() body: { trackers: string[] }) {
    const trackers = this.settings.setTrackers(body?.trackers ?? []);
    let rewritten = 0;
    for (const reciter of this.reciters.list()) {
      this.reciters.update(reciter.id, {
        magnet: this.settings.magnetFor(reciter.infohash, reciter.name),
      });
      rewritten += 1;
    }
    return { trackers, rewritten };
  }
}
