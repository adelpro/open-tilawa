import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { StatusService } from './status.service';
import { SeedersService } from '../seeders/seeders.service';
import { TurnsService } from '../turns/turns.service';

/**
 * One page for the whole stack: configured services with a 24-hour timeline,
 * plus the nodes and TURN servers that already keep their own monitors.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('status')
export class StatusController {
  constructor(
    private readonly status: StatusService,
    private readonly seeders: SeedersService,
    private readonly turns: TurnsService,
  ) {}

  @Get()
  overview() {
    return {
      services: this.status.overview(),
      seeders: this.seeders.list().map((seeder) => ({
        id: seeder.id,
        name: seeder.name,
        url: seeder.url,
        status: seeder.status,
        version: seeder.version,
        headroomBytes: seeder.headroomBytes,
        lastSeen: seeder.lastSeen,
      })),
      turns: this.turns.list().map((turn) => ({
        id: turn.id,
        name: turn.name,
        url: turn.url,
        status: turn.status,
        latencyMs: turn.latencyMs,
        lastSeen: turn.lastSeen,
        ...this.status.turnTimeline(turn.id),
      })),
    };
  }

  /** Run every check now, for the "refresh" button. */
  @Post('check')
  @HttpCode(HttpStatus.OK)
  async check() {
    await this.status.runAll();
    return this.overview();
  }

  @Post('services')
  @HttpCode(HttpStatus.CREATED)
  add(@Body() body: { name: string; url: string }) {
    return this.status.add(body?.name, body?.url);
  }

  @Delete('services/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.status.remove(Number(id));
  }
}
