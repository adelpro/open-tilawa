import { Module } from '@nestjs/common';
import { RecitersController } from './reciters.controller';
import { RecitersService } from './reciters.service';

@Module({
  controllers: [RecitersController],
  providers: [RecitersService],
  exports: [RecitersService],
})
export class RecitersModule {}
