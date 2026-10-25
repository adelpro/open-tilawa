import { Module } from '@nestjs/common';
import { AuthModule } from '@/auth/auth.module';
import { MailerModule } from '@/mailer/mailer.module';
import { TempLinksModule } from '@/temp-links/temp-links.module';
import { OwnerController } from './owner.controller';
import { OwnerService } from './owner.service';
import { OwnerTransferController } from './owner-transfer.controller';

/**
 * Owner transfer needs `AuthService` for the session it mints for the acceptor.
 * `AuthModule` does not import this module, so there is no cycle.
 */
@Module({
  imports: [AuthModule, MailerModule, TempLinksModule],
  controllers: [OwnerController, OwnerTransferController],
  providers: [OwnerService],
  exports: [OwnerService],
})
export class OwnerModule {}
