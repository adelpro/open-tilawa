import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { TorrentsService } from './torrents.service';

@UseGuards(JWTAuthGuard)
@Controller('torrents')
export class TorrentsController {
  constructor(private readonly service: TorrentsService) {}

  @Get()
  list() { return this.service.list(); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() body: { name: string; infohash: string; magnet: string }) {
    return this.service.add(body.name, body.infohash, body.magnet);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.service.remove(Number(id));
  }
}
