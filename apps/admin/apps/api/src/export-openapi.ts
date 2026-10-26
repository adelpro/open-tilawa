import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Writes the committed OpenAPI document (../../docs/openapi.json).
 *
 * Run after `yarn workspace @tilawa-admin/api build`, then format with prettier:
 *   node dist/export-openapi.js
 *   npx prettier --write ../../docs/openapi.json
 *
 * The same document build lives in test/openapi.spec.ts — the two must stay in
 * step, or the committed contract and the generated document drift.
 */
void (async (): Promise<void> => {
  // The document build has nothing to do with a database; the store opens one
  // anyway at import. An in-memory file keeps the export side-effect free.
  process.env.DB_PATH = ':memory:';

  const { AppModule } = await import('./app.module');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  const version = (JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8')) as {
    version: string;
  }).version;
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('Tilawa Admin API').setVersion(version).build(),
  );
  writeFileSync(
    join(__dirname, '..', '..', '..', 'docs', 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
  );
  await app.close();
  process.exit(0);
})();
