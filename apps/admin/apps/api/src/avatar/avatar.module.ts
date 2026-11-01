import { Module } from '@nestjs/common';
import { StoreModule } from '@/store/store.module';
import { UsersModule } from '@/users/users.module';
import { AvatarController, MeAvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

@Module({
  imports: [StoreModule, UsersModule],
  controllers: [MeAvatarController, AvatarController],
  providers: [AvatarService],
})
export class AvatarModule {}
