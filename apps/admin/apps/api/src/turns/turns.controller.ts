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
  Query,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { TurnsService } from './turns.service';

/**
 * Every route is console-only: these verbs mutate infrastructure records,
 * so an unauthenticated mutation would let a stranger register or delete them.
 */
@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('turns')
export class TurnsController {
  constructor(private readonly service: TurnsService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() body: { name: string; url: string }) {
    try {
      return this.service.add(body.name, body.url);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }

  @Get(':id')
  one(@Param('id') id: string) {
    const turn = this.service.get(Number(id));
    if (!turn) throw new NotFoundException('TURN server not found');
    return turn;
  }

  @Get(':id/history')
  history(@Param('id') id: string, @Query('limit') limit?: string) {
    const parsed = Number.parseInt(limit ?? '', 10);
    return this.service.history(
      Number(id),
      Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 288) : 50,
    );
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: { name?: string; url?: string }) {
    let updated;
    try {
      updated = this.service.update(Number(id), body);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    if (!updated) throw new NotFoundException('TURN server not found');
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
}
