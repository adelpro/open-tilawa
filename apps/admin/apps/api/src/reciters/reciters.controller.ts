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
import { SettingsService } from '../settings/settings.service';
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
   * Every stored magnet is rebuilt from the row's own identity: the configured
   * trackers and the exact-source URL, canonically encoded. Whatever a paste
   * carried outside the hash is not part of the release.
   */
  private normalised(magnet: string, infohash: string, name: string): string {
    const hash = (infohash ?? '').trim();
    if (!hash) return magnet;
    let label = (name ?? '').trim();
    if (!label && magnet?.startsWith('magnet:')) {
      try {
        label = new URL(magnet).searchParams.get('dn') ?? '';
      } catch {
        // a malformed magnet is not a reason to lose the row
      }
    }
    return this.settings.magnetFor(hash, label || hash);
  }

  @Get()
  list() {
    // Coverage, not just the rows: which nodes report each reciter, what was
    // asked of them, and the state that follows.
    return this.service.listWithPlacement();
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
      published?: boolean;
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
        published: body.published,
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
      nameAr?: string | null;
      riwaya?: string;
      infohash?: string;
      magnet?: string;
      fileCount?: number;
      sizeBytes?: number | null;
      published?: boolean;
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

  /** Put this reciter on specific nodes. Writes a pending placement per node. */
  @Post(':id/place')
  @HttpCode(HttpStatus.OK)
  place(
    @Param('id') id: string,
    @Body() body: { seederIds: number[] },
    @CurrentUser('id') actorId: string | number,
  ) {
    return this.push.place(
      Number(id),
      (body?.seederIds ?? []).map((entry) => Number(entry)),
      Number(actorId),
    );
  }

  /** Stop seeding on one node, keeping the files the HTTP source serves. */
  @Delete(':id/place/:seederId')
  @HttpCode(HttpStatus.OK)
  unplace(
    @Param('id') id: string,
    @Param('seederId') seederId: string,
    @CurrentUser('id') actorId: string | number,
  ) {
    return this.push.unplace(Number(id), Number(seederId), Number(actorId));
  }

  /**
   * Delete a catalogue row. `purge=all` also removes it from every node;
   * `purge=1,2` from exactly those. Omitted means the catalogue only, leaving
   * whatever the nodes hold as orphans — which the UI warns about.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  remove(
    @Param('id') id: string,
    @Query('purge') purge: string | undefined,
    @CurrentUser('id') actorId: string | number,
  ) {
    const target =
      purge === undefined || purge === ''
        ? null
        : purge === 'all'
          ? ('all' as const)
          : purge
              .split(',')
              .map((entry) => Number(entry))
              .filter((entry) => Number.isFinite(entry));
    return this.push.remove(Number(id), target, Number(actorId));
  }
}
