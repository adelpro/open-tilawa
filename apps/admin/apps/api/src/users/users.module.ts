import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

/**
 * The Mongoose registration is gone: `UsersRepository` arrives from the global
 * `StoreModule`, so this module only wires the service and its controller.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
