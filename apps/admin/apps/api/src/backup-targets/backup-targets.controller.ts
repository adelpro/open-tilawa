import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import type { BackupTarget } from '@tilawa-admin/core';
import { CurrentUser } from '@/auth/decorators/currentUser.decorator';
import { Roles } from '@/auth/decorators/roles.decorator';
import { JWTAuthGuard } from '@/auth/guards/jwt.guard';
import { RoleGuard } from '@/auth/guards/roles.guard';
import type { AuthenticatedUser } from '@/auth/types/authenticatedUser.type';
import {
  BackupCredentialDTO,
  CreateBackupTargetDTO,
  UpdateBackupTargetDTO,
} from './backup-targets.dto';
import { BackupTargetsService } from './backup-targets.service';
import type { BridgeFile } from './bridge.client';

/**
 * SFTP destinations for the Backups screen. The credential route is write-only:
 * no handler here can return a password or key, because the service never reads
 * one back from the bridge.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('backup-targets')
export class BackupTargetsController {
  constructor(private readonly targets: BackupTargetsService) {}

  @Get()
  @ApiOperation({ summary: 'List the SFTP backup destinations' })
  list(): BackupTarget[] {
    return this.targets.list();
  }

  @Post()
  @ApiOperation({ summary: 'Register an SFTP backup destination' })
  create(
    @Body() body: CreateBackupTargetDTO,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BackupTarget> {
    return this.targets.create(body, Number(user.id));
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an SFTP backup destination' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateBackupTargetDTO,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BackupTarget> {
    return this.targets.update(id, body, Number(user.id));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a destination (owner only)' })
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.targets.remove(id, Number(user.id));
  }

  @Put(':id/credentials')
  @ApiOperation({ summary: 'Save a credential (owner only, write-only)' })
  saveCredential(
    @Param('id') id: string,
    @Body() body: BackupCredentialDTO,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ saved: true }> {
    return this.targets.saveCredential(id, body, Number(user.id));
  }

  @Post(':id/check')
  @ApiOperation({ summary: 'Open the SFTP connection and persist the result' })
  check(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser): Promise<BackupTarget> {
    return this.targets.check(id, Number(user.id));
  }

  @Get(':id/files')
  @ApiOperation({ summary: 'List the snapshot files on one destination' })
  files(@Param('id') id: string): Promise<BridgeFile[]> {
    return this.targets.files(id);
  }

  @Get(':id/files/:name/download')
  @ApiOperation({ summary: 'Download one snapshot from a destination' })
  async download(@Param('id') id: string, @Param('name') name: string): Promise<StreamableFile> {
    const bytes = await this.targets.download(id, name);
    return new StreamableFile(bytes, {
      type: 'application/x-sqlite3',
      disposition: `attachment; filename="${name}"`,
    });
  }
}
