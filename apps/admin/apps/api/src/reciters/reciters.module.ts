import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { SeedersModule } from '../seeders/seeders.module';
import { RecitersController } from './reciters.controller';
import { RecitersService } from './reciters.service';
import { CataloguePushService } from './catalogue-push.service';

@Module({
  imports: [UsersModule, SeedersModule],
  controllers: [RecitersController],
  providers: [RecitersService, CataloguePushService],
  exports: [RecitersService],
})
export class RecitersModule {}
