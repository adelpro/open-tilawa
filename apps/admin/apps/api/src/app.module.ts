import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { TilawaThrottlerGuard } from './config/throttler.guard';

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
import { ToolsModule } from './tools/tools.module';
import { TurnsModule } from './turns/turns.module';
import { RecitersModule } from './reciters/reciters.module';
import { TwoFaModule } from './two-fa/two-fa.module';
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
    ToolsModule,
    TurnsModule,
    RecitersModule,
    TwoFaModule,
    AdminModule,
    SetupModule,
    CsrfModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: TilawaThrottlerGuard },
    CsrfMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes('*');
  }
}
