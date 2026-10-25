import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { RecitersService } from './reciters.service';

@Controller('reciters')
export class RecitersController {
  constructor(private readonly service: RecitersService) {}

  @Get()
  list() { return this.service.list(); }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() body: { name: string; riwaya: string; infohash: string; magnet: string; fileCount?: number }) {
    return this.service.add(body.name, body.riwaya, body.infohash, body.magnet, body.fileCount ?? 0);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.service.remove(Number(id));
  }
}
