import {
  BadRequestException,
  NotFoundException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RecitersService } from './reciters.service';
import { CataloguePushService } from './catalogue-push.service';
import { magnetForInfo, SettingsService } from '../settings/settings.service';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';

@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('reciters')
export class RecitersController {
  constructor(
    private readonly service: RecitersService,
    private readonly push: CataloguePushService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Every stored magnet announces to the configured trackers. A magnet pasted
   * without them keeps its own and gains ours; one with only a hash gets the
   * name and the list.
   */
  private normalised(magnet: string, infohash: string, name: string): string {
    const base = magnet?.startsWith('magnet:')
      ? magnet
      : magnetForInfo(infohash.trim(), name.trim(), this.settings.getTrackers());
    return this.settings.withTrackers(base);
  }

  @Get()
  list() {
    return this.service.list();
  }

  /** Fill the catalogue from a node's own inventory (sizes included). */
  @Post('import')
  @HttpCode(HttpStatus.OK)
  importFrom(@Body() body: { seederId: number }) {
    return this.push.importFrom(Number(body?.seederId));
  }

  /** What a push would do, without touching a node. */
  @Post('push/plan')
  @HttpCode(HttpStatus.OK)
  plan(@Body() body: { nodeIds?: number[] }) {
    return this.push.plan(body?.nodeIds);
  }

  /** Add every catalogue reciter a node is missing. Never removes. */
  @Post('push')
  @HttpCode(HttpStatus.ACCEPTED)
  apply(@Body() body: { nodeIds?: number[] }, @CurrentUser('id') actorId: string | number) {
    return this.push.apply(body?.nodeIds, Number(actorId));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(
    @Body()
    body: {
      name: string;
      riwaya: string;
      infohash: string;
      magnet: string;
      fileCount?: number;
      sizeBytes?: number | null;
    },
  ) {
    try {
      return this.service.add({
        name: body.name,
        riwaya: body.riwaya,
        infohash: body.infohash,
        magnet: this.normalised(body.magnet, body.infohash, body.name),
        fileCount: body.fileCount ?? 0,
        sizeBytes: body.sizeBytes ?? null,
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
      riwaya?: string;
      infohash?: string;
      magnet?: string;
      fileCount?: number;
      sizeBytes?: number | null;
    },
  ) {
    let updated;
    try {
      const current = this.service.get(Number(id));
      const patch =
        body.magnet === undefined && current
          ? { ...body, magnet: this.normalised(current.magnet, body.infohash ?? current.infohash, body.name ?? current.name) }
          : body.magnet !== undefined
            ? {
                ...body,
                magnet: this.normalised(
                  body.magnet,
                  body.infohash ?? current?.infohash ?? '',
                  body.name ?? current?.name ?? '',
                ),
              }
            : body;
      updated = this.service.update(Number(id), patch);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (!updated) throw new NotFoundException('reciter not found');
    return updated;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @Query('purgeNodes') purgeNodes: string | undefined,
    @CurrentUser('id') actorId: string | number,
  ) {
    return this.push.remove(Number(id), purgeNodes === 'true', Number(actorId));
  }
}
