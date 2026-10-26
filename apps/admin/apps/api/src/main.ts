import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DatabaseExceptionFilter } from './exceptions/database.exception.filter';
import { ValidationExceptionFilter } from './exceptions/validation.exception.filter';
import { corsConfigs } from './config/cors.config';

/**
 * The API binds PORT, defaulted here so an absent value is never fatal (T1.12).
 *
 * `cookie-parser` is not decoration: the JWT strategy reads the session token
 * from `req.cookies`, so without this middleware every authenticated route
 * answers 401 while sign-in still returns 200 and writes a session row. It was
 * found by running the service, not by reading it.
 */
/**
 * The package version, read once. Hardcoding it here made Swagger drift from
 * `/health` and from the OpenAPI export on the next release.
 */
const apiVersion = (() => {
  try {
    const raw = readFileSync(join(__dirname, '..', 'package.json'), 'utf8');
    return (JSON.parse(raw) as { version?: string }).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
})();

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });

  // The tools screen uploads a .torrent as base64 JSON (+33%), and torrent files
  // are routinely hundreds of kilobytes. The Express default is 100 kB, which
  // answered a real 295 kB file with 413.
  app.useBodyParser('json', { limit: '8mb' });
  app.useBodyParser('urlencoded', { limit: '1mb', extended: true });
  const config = app.get(ConfigService);

  // Behind the edge container: without this, throttling sees one client.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(cookieParser());
  app.use(helmet());
  app.enableCors(corsConfigs);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );
  app.useGlobalFilters(new DatabaseExceptionFilter(), new ValidationExceptionFilter());

  app.setGlobalPrefix('api');

  // The documentation is a route like any other. It is generated from the decorators
  // the controllers already carry, so a route that is not documented is a route that was
  // added without a decorator — and the drift test below catches that.
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Tilawa Admin API')
      .setDescription(
        'The HTTP API behind the Tilawa Admin dashboard. Authentication is a ' +
          'session cookie (POST /api/auth/local/signin). Every route except /api/health ' +
          'and the auth entry points requires one.',
      )
      .setVersion(apiVersion)
      .addCookieAuth('token')
      .build(),
  );
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  app.enableShutdownHooks();

  const port = Number(config.get<string>('PORT') ?? process.env.PORT ?? 9310);
  await app.listen(port, '0.0.0.0');
  new Logger('bootstrap').log(`tilawa-admin-api listening on ${port}`);
}

void bootstrap();
