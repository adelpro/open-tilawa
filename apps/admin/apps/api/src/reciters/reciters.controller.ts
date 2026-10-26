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
import { CataloguePushService } from './catalogue-push.service';
import { CurrentUser } from '../auth/decorators/currentUser.decorator';

@UseGuards(JWTAuthGuard, RoleGuard)
@Roles('admin')
@Controller('reciters')
export class RecitersController {
  constructor(
    private readonly service: RecitersService,
    private readonly push: CataloguePushService,
  ) {}

  @Get()
  list() {
    return this.service.list();
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
