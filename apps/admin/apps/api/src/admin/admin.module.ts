import { Module } from '@nestjs/common';
import { UsersModule } from '@/users/users.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

/**
 * Role administration. The repositories it needs (`UsersRepository`,
 * `ApiKeysRepository`, `SessionsRepository`, `AuditRepository`) and the raw
 * `SQLITE_DB` handle for transactions all come from the global `StoreModule`;
 * `UsersService` brings the argon2 hashing for created accounts.
 */
@Module({
  imports: [UsersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
