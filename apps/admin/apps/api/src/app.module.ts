import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { UslubThrottlerGuard } from './config/throttler.guard';

import { CsrfModule } from './csrf/csrf.module';
import { CsrfMiddleware } from './csrf/csrf.middleware';
import { SetupModule } from './setup/setup.module';
import { AdminModule } from './admin/admin.module';
import { HealthController } from './health.controller';
import { StoreModule } from './store/store.module';
import { TokensModule } from './tokens/tokens.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { MeModule } from './me/me.module';
import { SeedersModule } from './seeders/seeders.module';
import { TurnsModule } from './turns/turns.module';
import { TorrentsModule } from './torrents/torrents.module';
import { RecitersModule } from './reciters/reciters.module';
import { envValidate } from './config/env/env.validate';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? 'development'}`, '.env'],
      validate: envValidate,
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 20 }]),
    StoreModule,
    UsersModule,
    AuthModule,
    TokensModule,
    MeModule,
    SeedersModule,
    TurnsModule,
    TorrentsModule,
    RecitersModule,
    AdminModule,
    SetupModule,
    CsrfModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: UslubThrottlerGuard },
    CsrfMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
