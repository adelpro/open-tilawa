import { bootHarness, type Harness } from './harness';
import { SetupService } from '../src/setup/setup.service';

/**
 * The bootstrap path is the root of trust: the first account becomes the Owner,
 * the token is single-use, and two concurrent requests cannot create two owners.
 */
describe('setup and the claim gate', () => {
  let h: Harness;

  const body = (token: string) => ({
    token,
    name: 'Founder',
    email: 'founder@example.com',
    password: 'FounderPass123',
  });

  beforeAll(async () => {
    h = await bootHarness({ claimed: false });
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(() => {
    // One harness per file: the app's config is frozen at first import. Reset
    // the ownership tables between cases instead of booting a second app.
    h.db.exec(
      'DELETE FROM sessions; DELETE FROM audit_log; DELETE FROM setup_tokens; DELETE FROM users;',
    );
  });

  it('reports required until an owner exists', async () => {
    const before = await h.agent().get('/api/setup/status').expect(200);
    expect(before.body).toEqual({ required: true });

    const token = h.app.get(SetupService).generateToken();
    await h.agent().post('/api/setup').send(body(token)).expect(201);

    const after = await h.agent().get('/api/setup/status').expect(200);
    expect(after.body).toEqual({ required: false });
  });

  it('creates a super_admin with the owner flag and refuses a second setup', async () => {
    const setup = h.app.get(SetupService);
    const token = setup.generateToken();
    const res = await h.agent().post('/api/setup').send(body(token)).expect(201);
    expect(res.body.email).toBe('founder@example.com');

    const owner = h.users.getOwner();
    expect(owner?.email).toBe('founder@example.com');
    expect(owner?.role).toBe('super_admin');
    expect(owner?.isActivated).toBe(true);
    expect(owner?.isOwner).toBe(true);

    const second = setup.generateToken();
    await h.agent().post('/api/setup').send(body(second)).expect(409);
  });

  it('refuses signup before setup and allows it after', async () => {
    await h
      .agent()
      .post('/api/auth/local/signup')
      .send({ user: { name: 'Early', email: 'early@example.com', password: 'Password123' } })
      .expect(503);

    const token = h.app.get(SetupService).generateToken();
    await h.agent().post('/api/setup').send(body(token)).expect(201);

    await h
      .agent()
      .post('/api/auth/local/signup')
      .send({ user: { name: 'Later', email: 'later@example.com', password: 'Password123' } })
      .expect(201);
  });

  it('creates exactly one owner when two setups race', async () => {
    const setup = h.app.get(SetupService);
    const one = setup.generateToken();
    const two = setup.generateToken();

    const results = await Promise.all([
      h.agent().post('/api/setup').send(body(one)),
      h.agent().post('/api/setup').send(body(two)),
    ]);
    const statuses = results.map((result) => result.status).sort();
    expect(statuses).toEqual([201, 409]);
    expect(h.users.getAll().filter((user) => user.isOwner)).toHaveLength(1);
  });
});
