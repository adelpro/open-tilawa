import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { AddressInfo } from 'node:net';
import { openDatabase, UsersRepository, type Db, type Role } from '@tilawa-admin/core';
import { MAIL_TRANSPORT } from '../src/mailer/mailer.types';
import { UsersService } from '../src/users/users.service';

export interface RecordedMail {
  to: string;
  subject: string;
  html: string;
}

/**
 * A recorder standing in for the Gmail transport.
 *
 * Tests read the message the user would have received, which is the only way to
 * assert on the activation and reset links without a real mailbox — and it keeps
 * the templates themselves under test.
 */
export function createMailRecorder() {
  const sent: RecordedMail[] = [];
  return {
    sent,
    transport: {
      kind: 'smtp' as const,
      async send(message: RecordedMail): Promise<{ messageId: string }> {
        sent.push(message);
        return { messageId: `test-${sent.length}` };
      },
    },
    last(): RecordedMail {
      const message = sent.at(-1);
      if (!message) throw new Error('no mail was sent');
      return message;
    },
    clear(): void {
      sent.length = 0;
    },
  };
}

/** The temporary token is embedded in the mail body; this is how a user gets it. */
const JWT = /[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/;
export function tokenFromMail(mail: RecordedMail): string {
  const match = mail.html.match(JWT);
  if (!match) throw new Error(`no token in mail with subject "${mail.subject}"`);
  return match[0];
}

export interface RecordedIdentity {
  subject: string;
  email: string;
  verified: boolean;
  name: string;
}

export interface Harness {
  app: INestApplication;
  mail: ReturnType<typeof createMailRecorder>;
  db: Db;
  users: UsersRepository;
  dir: string;
  /** The seeded Owner, or null when the harness booted unclaimed. */
  ownerId: number | null;
  ownerEmail: string;
  close(): Promise<void>;
  /** Creates an already-activated account directly, bypassing the mail loop. */
  seedUser(input: {
    name: string;
    email: string;
    password: string;
    role?: Role;
    status?: 'active' | 'disabled';
  }): Promise<number>;
  agent(): ReturnType<typeof request.agent>;
}

export async function bootHarness(options: { claimed?: boolean } = {}): Promise<Harness> {
  const claimed = options.claimed ?? true;
  const dir = mkdtempSync(join(tmpdir(), 'uslub-auth-'));
  const dbPath = join(dir, 'test.sqlite');

  process.env.NODE_ENV = 'test';
  process.env.DB_PATH = dbPath;
  process.env.COOKIE_JWT_SECRET = 'test-cookie-secret';
  process.env.TEMP_JWT_SECRET = 'test-temp-secret';
  process.env.TEMP_JWT_TTL_MS = '900000';
  process.env.COOKIE_JWT_TTL_MS = '604800000';
  process.env.USLUB_PEPPER = 'test-pepper';
  process.env.USLUB_VENDOR_DIR = join(__dirname, '..', '..', '..', 'vendor');
  process.env.APP_NAME = 'Uslub';
  process.env.WEBSITE = 'http://localhost:9320';
  // Providers are "configured" only when both halves of the credential exist, so the
  // harness sets them: without them `/auth/providers` is empty and every callback
  // answers provider_disabled — a different code path than the one under test.
  process.env.GOOGLE_CLIENT_ID = 'test-google-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
  process.env.GITHUB_CLIENT_ID = 'test-github-id';
  process.env.GITHUB_CLIENT_SECRET = 'test-github-secret';
  // No Gmail credentials: the transport is overridden below, but the environment
  // must match a development boot so nothing else validates differently.
  delete process.env.EMAIL;
  delete process.env.EMAIL_APP_SPECIFIC_PASS;

  const mail = createMailRecorder();

  /**
   * `AppModule` is imported **after** the environment is set, not at the top of
   * the file. `ConfigModule.forRoot` validates and freezes the environment when
   * the module is first evaluated, so a static import captures whatever `.env`
   * and defaults existed at that moment — the first version of this harness
   * silently ran against the development database instead of its throwaway one.
   */
  const { AppModule } = await import('../src/app.module');

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(MAIL_TRANSPORT)
    .useValue(mail.transport)
    // Throttling is skipped by `UslubThrottlerGuard` when NODE_ENV is `test`;
    // the override below is belt-and-braces for the same intent.
    .overrideProvider(APP_GUARD)
    .useValue({ canActivate: () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  await app.init();
  await app.listen(0, '127.0.0.1');

  const db = openDatabase(dbPath);
  const users = new UsersRepository(db);

  // Every existing suite signs up or seeds accounts through the real service.
  // Seeding an Owner first keeps those flows on the claimed path; the tests that
  // exercise the gate boot with `{ claimed: false }`.
  const ownerEmail = 'instance-owner@example.com';
  let ownerId: number | null = null;
  if (claimed) {
    const usersService = app.get(UsersService);
    const owner = await usersService.create(
      {
        name: 'Instance Owner',
        email: ownerEmail,
        password: 'OwnerPass123',
        role: 'super_admin',
        isActivated: true,
        isOwner: true,
      },
      { allowUnclaimed: true },
    );
    ownerId = owner.id;
  }

  return {
    app,
    mail,
    db,
    users,
    dir,
    ownerId,
    ownerEmail,
    async close() {
      db.close();
      await app.close();
      rmSync(dir, { recursive: true, force: true });
    },
    async seedUser(input) {
      // Hashing goes through the app's own service, so the stored hash is the
      // same one sign-in expects — no second implementation in the tests.
      const usersService = app.get(UsersService);
      const created = await usersService.create(
        {
          name: input.name,
          email: input.email,
          password: input.password,
        },
        // Seeding an account is a fixture, not a product creation path; it must
        // work on an unclaimed harness so the gate tests can seed state too.
        { allowUnclaimed: true },
      );
      const patch: { role?: Role; status?: string; isActivated?: boolean } = {
        isActivated: true,
      };
      if (input.role) patch.role = input.role;
      if (input.status) patch.status = input.status;
      users.update(created.id, patch);
      return created.id;
    },
    agent() {
      return request.agent(app.getHttpServer());
    },
  };
}

/** The bound port, for callers that need to sign a request themselves. */
export function portOf(app: INestApplication): number {
  return (app.getHttpServer().address() as AddressInfo).port;
}
