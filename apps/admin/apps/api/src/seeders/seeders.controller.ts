import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SeedersService } from './seeders.service';

@Controller('seeders')
export class SeedersController {
  constructor(private readonly service: SeedersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  add(@Body() body: { name: string; url: string }) {
    return this.service.add(body.name, body.url);
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