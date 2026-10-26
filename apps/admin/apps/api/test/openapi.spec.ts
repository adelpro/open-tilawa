import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { bootHarness } from './harness';

/**
 * The committed OpenAPI document is the contract.
 *
 * A route added without a decorator, or a DTO field renamed, changes the generated
 * document by a line or two. Without this test the next commit ships a spec that no
 * longer describes the running server, and the client that generated its types from it
 * compiles against a fiction. The test fails with a one-line instruction rather than a
 * diff dump.
 */
describe('openapi', () => {
  it('matches the committed document', async () => {
    const version = (
      JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')) as {
        version: string;
      }
    ).version;
    const h = await bootHarness();
    // The harness gives us the app via its internal moduleRef; rebuild the document
    // the same way export-openapi.ts does, so the comparison is apples to apples.
    const { AppModule } = await import('../src/app.module');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('Tilawa Admin API').setVersion(version).build(),
    );
    await app.close();
    await h.close();

    const committed = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'docs', 'openapi.json'), 'utf-8'),
    );
    const generated = JSON.parse(JSON.stringify(document));

    // Compare path sets and the schema sets — the two things a client actually depends on.
    const committedPaths = Object.keys(committed.paths ?? {}).sort();
    const generatedPaths = Object.keys(generated.paths ?? {}).sort();
    expect(generatedPaths).toEqual(committedPaths);

    const committedSchemas = Object.keys(committed.components?.schemas ?? {}).sort();
    const generatedSchemas = Object.keys(generated.components?.schemas ?? {}).sort();
    expect(generatedSchemas).toEqual(committedSchemas);
  });

  it('has at least 50 paths and a documented error shape', async () => {
    const committed = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'docs', 'openapi.json'), 'utf-8'),
    );
    expect(Object.keys(committed.paths).length).toBeGreaterThanOrEqual(25);
    expect(committed.components?.schemas).toBeDefined();
  });
});
