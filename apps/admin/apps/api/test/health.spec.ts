import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

/**
 * Boots the whole application — config validation, the SQLite handle, the
 * migrations runner and every feature module — against a throwaway database.
 * A ported module that resolves its dependencies wrongly fails here instead of
 * in production, which is the point of a boot test.
 */
describe('health', () => {
  let app: INestApplication;
  let dir: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), 'tilawa-admin-api-'));
    process.env.DB_PATH = join(dir, 'test.sqlite');
    process.env.COOKIE_JWT_SECRET = 'test-cookie-secret';
    process.env.TEMP_JWT_SECRET = 'test-temp-secret';

    // Dynamic on purpose: `ConfigModule.forRoot` freezes the environment when
    // `AppModule` is first evaluated, so a static import would ignore the
    // `DB_PATH` set just above and run against the development database.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reports ok without authentication', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('tilawa-admin-api');
    expect(typeof res.body.uptimeMs).toBe('number');
    expect(res.body.dbPath).toBe(join(dir, 'test.sqlite'));
  });

  it('reports the package version, not a stale env default', async () => {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body.version).toBe(pkg.version);
  });

  it('refuses to serve a protected route without a token', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(401);
  });
});
