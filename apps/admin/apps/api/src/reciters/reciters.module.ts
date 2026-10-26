import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { RecitersController } from './reciters.controller';
import { RecitersService } from './reciters.service';

@Module({
  imports: [UsersModule],
  controllers: [RecitersController],
  providers: [RecitersService],
  exports: [RecitersService],
})
export class RecitersModule {}
