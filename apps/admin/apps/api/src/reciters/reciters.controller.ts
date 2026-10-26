import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { JWTAuthGuard } from '../auth/guards/jwt.guard';
import { RoleGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { RecitersService } from './reciters.service';

@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('reciters')
export class RecitersController {
  constructor(private readonly service: RecitersService) {}

  @Get()
  list() {
    return this.service.list();
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
    },
  ) {
    return this.service.add(
      body.name,
      body.riwaya,
      body.infohash,
      body.magnet,
      body.fileCount ?? 0,
    );
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    this.service.remove(Number(id));
  }
}
