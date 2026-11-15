import {
  Controller,
  Get,
  Param,
  Post,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BackupsService } from './backups.service';

/**
 * What the host backup job did, and the files it left behind.
 *
 * Admin only, like the rest of the fleet surfaces: a snapshot contains every
 * account, every catalogue row and the audit log, so a signed-in user has no
 * business listing them, let alone downloading one.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('backups')
export class BackupsController {
  constructor(private readonly backups: BackupsService) {}

  @Get()
  @ApiOperation({ summary: 'Catalogue snapshots: the newest here, and the newest on the node.' })
  overview() {
    return this.backups.overview();
  }

  @Post('run')
  @ApiOperation({ summary: 'Take a snapshot now and push it to the remote.' })
  run() {
    return this.backups.run();
  }

  @Get(':name/download')
  @ApiOperation({ summary: 'Download one catalogue snapshot.' })
  async download(@Param('name') name: string): Promise<StreamableFile> {
    const path = await this.backups.pathFor(name);
    return new StreamableFile(createReadStream(path), {
      type: 'application/x-sqlite3',
      disposition: `attachment; filename="${name}"`,
    });
  }
}
