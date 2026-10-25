import { createHash, randomBytes } from 'node:crypto';
import { bootHarness } from './harness';

const alice = { name: 'Alice', email: 'alice-audit@adelpro.us.kg', password: 'Audit-p4ss-2026' };
const mallory = {
  name: 'Mallory',
  email: 'mallory-audit@adelpro.us.kg',
  password: 'Audit-p4ss-2026',
};

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

describe('oauth approve and scope binding (audit fixes)', () => {
  let h: Awaited<ReturnType<typeof bootHarness>>;
  let agent: ReturnType<typeof h.agent>;
  let agentM: ReturnType<typeof h.agent>;
  let csrf = '';

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser(alice);
    await h.seedUser(mallory);
    agent = h.agent();
    agentM = h.agent();
    await agent.post('/api/auth/local/signin').send({ user: alice }).expect(200);
    await agentM.post('/api/auth/local/signin').send({ user: mallory }).expect(200);
    csrf = (await agent.get('/api/csrf').expect(200)).body.token as string;
    await agentM.get('/api/csrf').expect(200);
  });

  afterAll(async () => {
    await h.close();
  });

  async function register(agentX: ReturnType<typeof h.agent>, scope?: string) {
    const reg = await agentX
      .post('/api/oauth/register')
      .send(
        scope
          ? { client_name: 'M', redirect_uris: ['http://localhost:9999/cb'], scope }
          : { client_name: 'M', redirect_uris: ['http://localhost:9999/cb'] },
      )
      .expect(201);
    return reg.body.client_id as string;
  }

  it('rejects an unauthenticated approve - no cookie, no code', async () => {
    const clientId = await register(agent);
    const { challenge } = pkce();
    const anon = h.agent();
    const res = await anon
      .post('/api/oauth/authorize/approve')
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read',
        code_challenge: challenge,
      })
      .expect(200);
    expect(res.body).toEqual({ error: 'access_denied', error_description: 'no signed-in session' });
  });

  it('rejects an approve whose user_id does not match the session principal', async () => {
    const clientId = await register(agent);
    const { challenge } = pkce();
    const res = await agent
      .post('/api/oauth/authorize/approve')
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read',
        code_challenge: challenge,
        user_id: 99999,
      })
      .expect(200);
    expect(res.body.error).toBe('access_denied');
  });

  it('authorises a bindable approve without a client-supplied user_id', async () => {
    const clientId = await register(agent);
    const { verifier, challenge } = pkce();
    const res = await agent
      .post('/api/oauth/authorize/approve')
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read',
        code_challenge: challenge,
      })
      .expect(200);
    const code = new URL(res.body.redirect).searchParams.get('code');
    expect(code).toBeTruthy();
    const tokenRes = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:9999/cb',
        client_id: clientId,
        code_verifier: verifier,
      })
      .expect(200);
    expect(tokenRes.body.access_token).toBeTruthy();
    const me = await agent
      .get('/api/me')
      .set('Authorization', `Bearer ${tokenRes.body.access_token}`)
      .expect(200);
    expect(me.body.email).toBe(alice.email);
  });

  it('narrows an approve scope wider than registration', async () => {
    const clientId = await register(agent, 'profile:read');
    const { verifier, challenge } = pkce();
    const res = await agent
      .post('/api/oauth/authorize/approve')
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read profile:write gate:run',
        code_challenge: challenge,
      })
      .expect(200);
    const code = new URL(res.body.redirect).searchParams.get('code');
    const tokenRes = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:9999/cb',
        client_id: clientId,
        code_verifier: verifier,
      })
      .expect(200);
    expect(tokenRes.body.scope).toBe('profile:read');
  });

  it('refresh cannot restate a wider scope than the original grant', async () => {
    const clientId = await register(agent, 'profile:read');
    const { verifier, challenge } = pkce();
    const res = await agent
      .post('/api/oauth/authorize/approve')
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read',
        code_challenge: challenge,
      })
      .expect(200);
    const code = new URL(res.body.redirect).searchParams.get('code');
    const tokenRes = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:9999/cb',
        client_id: clientId,
        code_verifier: verifier,
      })
      .expect(200);
    const wide = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokenRes.body.refresh_token,
        client_id: clientId,
        scope: 'profile:read gate:run',
      })
      .expect(200);
    expect(wide.body.error).toBe('invalid_grant');
    const same = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokenRes.body.refresh_token,
        client_id: clientId,
        scope: 'profile:read',
      })
      .expect(200);
    expect(same.body.scope).toBe('profile:read');
  });
});
