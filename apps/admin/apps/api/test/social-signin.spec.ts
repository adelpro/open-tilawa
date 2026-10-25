import { bootHarness, type Harness } from './harness';
import { UsersService } from '../src/users/users.service';
import type { INestApplication } from '@nestjs/common';

/**
 * Provider sign-in (P9).
 *
 * Consent cannot be automated, so the provider's own answers are replaced and
 * everything downstream is the real code: the account rules, the linking, the state
 * check, the session. Those are where the failures that matter live.
 *
 * The two rules these tests exist to pin:
 *  1. an unverified address can never identify an account;
 *  2. an existing account is never merged silently by email — that is a takeover,
 *     not a convenience.
 */
describe('social sign-in', () => {
  let h: Harness;
  let app: INestApplication;

  beforeAll(async () => {
    h = await bootHarness();
    app = h.app;
  });

  afterAll(async () => {
    await h.close();
  });

  beforeEach(() => {
    h.oauth.reset();
    h.mail.clear();
  });

  /** Start a flow and return the state the provider would echo back. */
  const begin = async (agent: ReturnType<Harness['agent']>, path: string): Promise<string> => {
    const response = await agent.get(path).expect(302);
    const location = new URL(response.headers.location);
    const state = location.searchParams.get('state');
    expect(state).toBeTruthy();
    return state as string;
  };

  const finish = (agent: ReturnType<Harness['agent']>, provider: string, state: string) =>
    agent.get(`/api/auth/${provider}/callback?code=test-code&state=${encodeURIComponent(state)}`);

  const me = (agent: ReturnType<Harness['agent']>) => agent.get('/api/me').expect(200);

  it('offers a provider only when its credentials exist', async () => {
    const response = await h.agent().get('/api/auth/providers').expect(200);
    expect(response.body.providers.sort()).toEqual(['github', 'google']);
  });

  it('creates an account from a verified provider identity, with no password', async () => {
    h.oauth.identity('google', {
      subject: 'google-1',
      email: 'new.person@example.com',
      verified: true,
      name: 'New Person',
    });

    const agent = h.agent();
    const state = await begin(agent, '/api/auth/google/start');
    const callback = await finish(agent, 'google', state).expect(302);

    expect(callback.headers.location).toBe('http://localhost:9320/dashboard');

    const profile = await me(agent);
    expect(profile.body.email).toBe('new.person@example.com');
    expect(profile.body.name).toBe('New Person');
    // A provider account has no password to be wrong until its owner sets one.
    expect(profile.body.passwordSet).toBe(false);

    const identities = await agent.get('/api/me/identities').expect(200);
    expect(identities.body.identities).toHaveLength(1);
    expect(identities.body.identities[0].provider).toBe('google');
  });

  it('refuses an address the provider did not verify, and creates nothing', async () => {
    h.oauth.identity('google', {
      subject: 'google-unverified',
      email: 'unverified@example.com',
      verified: false,
      name: 'Unverified',
    });

    const agent = h.agent();
    const state = await begin(agent, '/api/auth/google/start');
    const callback = await finish(agent, 'google', state).expect(302);

    expect(callback.headers.location).toContain('error=unverified_email');
    const existing = h.db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?')
      .get('unverified@example.com') as { n: number };
    expect(existing.n).toBe(0);
  });

  it('never merges into an existing local account by email', async () => {
    await h.seedUser({
      name: 'Local Person',
      email: 'local@example.com',
      password: 'LocalPassword2026',
    });

    h.oauth.identity('google', {
      subject: 'google-existing',
      email: 'local@example.com',
      verified: true,
      name: 'Local Person',
    });

    const agent = h.agent();
    const state = await begin(agent, '/api/auth/google/start');
    const callback = await finish(agent, 'google', state).expect(302);

    expect(callback.headers.location).toContain('error=account_exists');

    // The local account is untouched: no identity was attached to it.
    const identities = h.db
      .prepare('SELECT COUNT(*) AS n FROM user_identities WHERE email = ?')
      .get('local@example.com') as { n: number };
    expect(identities.n).toBe(0);

    // And the password still works, which is what the person is being told to use.
    await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'local-person')
      .send({ user: { email: 'local@example.com', password: 'LocalPassword2026' } })
      .expect(200);
  });

  it('signs the same provider identity into the same account, twice', async () => {
    h.oauth.identity('github', {
      subject: '4242',
      email: 'octo@example.com',
      verified: true,
      name: 'Octo',
    });

    const first = h.agent();
    await finish(first, 'github', await begin(first, '/api/auth/github/start')).expect(302);
    const firstProfile = await me(first);

    const second = h.agent();
    await finish(second, 'github', await begin(second, '/api/auth/github/start')).expect(302);
    const secondProfile = await me(second);

    expect(secondProfile.body.id).toBe(firstProfile.body.id);

    const accounts = h.db
      .prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?')
      .get('octo@example.com') as { n: number };
    expect(accounts.n).toBe(1);
  });

  it('links a provider to the signed-in account when the flow starts from Account', async () => {
    const userId = await h.seedUser({
      name: 'Linker',
      email: 'linker@example.com',
      password: 'LinkerPassword2026',
    });

    h.oauth.identity('google', {
      subject: 'google-link',
      email: 'linker@example.com',
      verified: true,
      name: 'Linker',
    });

    const agent = h.agent();
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'linker-device')
      .send({ user: { email: 'linker@example.com', password: 'LinkerPassword2026' } })
      .expect(200);

    const state = await begin(agent, '/api/auth/google/link');
    const callback = await finish(agent, 'google', state).expect(302);
    expect(callback.headers.location).toBe(
      'http://localhost:9320/dashboard/account?connected=google',
    );

    const profile = await me(agent);
    expect(profile.body.id).toBe(userId);
    // A password still exists, so this account can sign in either way.
    expect(profile.body.passwordSet).toBe(true);

    const identities = await agent.get('/api/me/identities').expect(200);
    expect(identities.body.identities.map((entry: { provider: string }) => entry.provider)).toEqual(
      ['google'],
    );
  });

  it('refuses to link an identity that already belongs to another account', async () => {
    h.oauth.identity('google', {
      subject: 'google-taken',
      email: 'taken@example.com',
      verified: true,
      name: 'Taken',
    });

    const owner = h.agent();
    await finish(owner, 'google', await begin(owner, '/api/auth/google/start')).expect(302);

    await h.seedUser({
      name: 'Second Person',
      email: 'second@example.com',
      password: 'SecondPassword2026',
    });

    const second = h.agent();
    await second
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'second-device')
      .send({ user: { email: 'second@example.com', password: 'SecondPassword2026' } })
      .expect(200);

    const state = await begin(second, '/api/auth/google/link');
    const callback = await finish(second, 'google', state).expect(302);

    expect(callback.headers.location).toContain('error=identity_taken');

    const owned = h.db
      .prepare('SELECT user_id FROM user_identities WHERE subject = ?')
      .get('google-taken') as { user_id: number };
    expect(owned.user_id).not.toBe((await second.get('/api/me').expect(200)).body.id);
  });

  it('rejects a callback whose state does not match the cookie', async () => {
    h.oauth.identity('google', {
      subject: 'google-state',
      email: 'state@example.com',
      verified: true,
      name: 'State',
    });

    const agent = h.agent();
    await begin(agent, '/api/auth/google/start');

    // Right cookie, wrong state: the signature is valid but the nonce is not the one
    // this flow issued, which is exactly the replayed-callback case.
    const callback = await agent
      .get('/api/auth/google/callback?code=test-code&state=not-the-state')
      .expect(302);

    expect(callback.headers.location).toContain('error=state_invalid');
  });

  it('answers a provider that refuses the code with a redirect, not a stack trace', async () => {
    h.oauth.failTokens();
    const agent = h.agent();
    const state = await begin(agent, '/api/auth/google/start');
    const callback = await finish(agent, 'google', state).expect(302);

    expect(callback.headers.location).toContain('error=provider_error');
  });

  it('answers a provider-only account exactly like a wrong password (no existence oracle)', async () => {
    h.oauth.identity('github', {
      subject: '9001',
      email: 'provider.only@example.com',
      verified: true,
      name: 'Provider Only',
    });

    const agent = h.agent();
    await finish(agent, 'github', await begin(agent, '/api/auth/github/start')).expect(302);

    // A wrong password against a provider-linked account used to answer 409
    // naming the provider, while unknown addresses answered a generic 401 —
    // an account-existence oracle paired with a "this person uses Google"
    // signal. Both wrong-password paths now answer the same generic 401
    // (audit: provider-reveal-409); the operator keeps the server-side warn.
    const attempt = await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'provider-only-device')
      .send({ user: { email: 'provider.only@example.com', password: 'anything' } })
      .expect(401);

    expect(String(attempt.body.message)).toBe('Invalid email or password');
    expect(attempt.body.provider).toBeUndefined();

    const unknown = await h
      .agent()
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'provider-only-device')
      .send({ user: { email: 'nobody.example@example.com', password: 'anything' } })
      .expect(401);
    expect(String(unknown.body.message)).toBe('Invalid email or password');
  });

  it('answers 404 when disconnecting a provider that was never connected', async () => {
    const agent = h.agent();
    await h.seedUser({
      name: 'Never Linked',
      email: 'never.linked@example.com',
      password: 'NeverLinked2026',
    });
    await agent
      .post('/api/auth/local/signin')
      .set('X-Fingerprint', 'never-linked-device')
      .send({ user: { email: 'never.linked@example.com', password: 'NeverLinked2026' } })
      .expect(200);

    const missing = await agent.delete('/api/me/identities/github').expect(404);
    expect(String(missing.body.message)).toMatch(/not connected/i);
  });

  it('refuses to disconnect the only way into an account', async () => {
    h.oauth.identity('google', {
      subject: 'google-last',
      email: 'last@example.com',
      verified: true,
      name: 'Last',
    });

    const agent = h.agent();
    await finish(agent, 'google', await begin(agent, '/api/auth/google/start')).expect(302);

    const refused = await agent.delete('/api/me/identities/google').expect(409);
    expect(String(refused.body.message)).toMatch(/set a password/i);

    // With a password set, the same call succeeds — and takes the identity away.
    const profile = await me(agent);
    await app.get(UsersService).update(profile.body.id, { password: 'NowPassword2027' });
    await agent.delete('/api/me/identities/google').expect(200);

    const identities = await agent.get('/api/me/identities').expect(200);
    expect(identities.body.identities).toEqual([]);
  });
});
