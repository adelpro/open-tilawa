import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { BackupsController } from './backups.controller';
import { BackupsService } from './backups.service';

/**
 * `UsersModule` is here for `RoleGuard`, which re-reads the caller's role from the
 * database on every request rather than trusting the token's claim.
 */
@Module({
  imports: [UsersModule],
  controllers: [BackupsController],
  providers: [BackupsService],
})
export class BackupsModule {}
