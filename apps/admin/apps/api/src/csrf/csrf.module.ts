import { Module } from '@nestjs/common';
import { CsrfController } from './csrf.controller';
import { CsrfService } from './csrf.service';

/**
 * The service is exported so `AppModule` can resolve it when it binds the
 * middleware; the middleware itself is not provided here, because a Nest
 * middleware bound through a feature module's `configure()` only covers that
 * module's routes.
 */
@Module({
  controllers: [CsrfController],
  providers: [CsrfService],
  exports: [CsrfService],
})
export class CsrfModule {}
