import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { StoreModule } from '@/store/store.module';
import { TempLinksService } from './temp-links.service';

@Module({
  imports: [StoreModule, JwtModule.register({})],
  providers: [TempLinksService],
  exports: [TempLinksService],
})
export class TempLinksModule {}
