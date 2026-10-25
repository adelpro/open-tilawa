import { Module } from '@nestjs/common';
import { TorrentsController } from './torrents.controller';
import { TorrentsService } from './torrents.service';

@Module({
  controllers: [TorrentsController],
  providers: [TorrentsService],
  exports: [TorrentsService],
})
export class TorrentsModule {}
