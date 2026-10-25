import { createHash, randomBytes } from 'node:crypto';
import { bootHarness } from './harness';

const account = { name: 'OAuth Tester', email: 'oauth@adelpro.us.kg', password: 'Audit-p4ss-2026' };

function pkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

describe('oauth mcp (P15)', () => {
  let h: Awaited<ReturnType<typeof bootHarness>>;
  let agent: ReturnType<typeof h.agent>;
  let csrf = '';

  beforeAll(async () => {
    h = await bootHarness();
    await h.seedUser(account);
    agent = h.agent();
    await agent.post('/api/auth/local/signin').send({ user: account }).expect(200);
    const t = await agent.get('/api/csrf').expect(200);
    csrf = t.body.token as string;
  });

  afterAll(async () => {
    await h.close();
  });

  it('registers a public client', async () => {
    const res = await agent
      .post('/api/oauth/register')
      .set('x-csrf-token', csrf)
      .send({ client_name: 'Test Client', redirect_uris: ['http://localhost:9999/cb'] })
      .expect(201);
    expect(res.body.client_id).toBeTruthy();
    expect(res.body.client_secret).toBeUndefined();
  });

  it('runs the full authorization-code + PKCE flow', async () => {
    // register
    const reg = await agent
      .post('/api/oauth/register')
      .set('x-csrf-token', csrf)
      .send({ client_name: 'Flow Client', redirect_uris: ['http://localhost:9999/cb'] })
      .expect(201);
    const clientId = reg.body.client_id as string;

    const { verifier, challenge } = pkce();

    // authorize: should redirect to consent
    const authRes = await agent
      .get('/api/oauth/authorize')
      .query({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      .expect(302);
    const consentUrl = authRes.headers.location as string;
    expect(consentUrl).toContain('/oauth/consent');

    // approve
    const cparams = new URL(consentUrl, 'http://localhost').searchParams;
    const approveRes = await agent
      .post('/api/oauth/authorize/approve')
      .set('x-csrf-token', csrf)
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        scope: 'profile:read',
        code_challenge: challenge,
        user_id: Number(cparams.get('user_id')),
      })
      .expect(200);
    const code = new URL(approveRes.body.redirect).searchParams.get('code');
    expect(code).toBeTruthy();

    // token exchange
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
    expect(tokenRes.body.refresh_token).toBeTruthy();

    // access token works on /api/me
    const meRes = await agent
      .get('/api/me')
      .set('Authorization', `Bearer ${tokenRes.body.access_token}`)
      .expect(200);
    expect(meRes.body.email).toBe(account.email);

    // refresh
    const refreshRes = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokenRes.body.refresh_token,
        client_id: clientId,
      })
      .expect(200);
    expect(refreshRes.body.access_token).toBeTruthy();
    expect(refreshRes.body.refresh_token).toBeTruthy();
    expect(refreshRes.body.refresh_token).not.toBe(tokenRes.body.refresh_token);
  });

  it('rejects a bad code_verifier', async () => {
    const reg = await agent
      .post('/api/oauth/register')
      .set('x-csrf-token', csrf)
      .send({ client_name: 'BadVerifier', redirect_uris: ['http://localhost:9999/cb'] })
      .expect(201);
    const clientId = reg.body.client_id as string;
    const { challenge } = pkce();
    const authRes = await agent
      .get('/api/oauth/authorize')
      .query({
        response_type: 'code',
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        code_challenge: challenge,
        code_challenge_method: 'S256',
      })
      .expect(302);
    const cparams = new URL(authRes.headers.location, 'http://localhost').searchParams;
    const approveRes = await agent
      .post('/api/oauth/authorize/approve')
      .set('x-csrf-token', csrf)
      .send({
        client_id: clientId,
        redirect_uri: 'http://localhost:9999/cb',
        code_challenge: challenge,
        user_id: Number(cparams.get('user_id')),
      })
      .expect(200);
    const code = new URL(approveRes.body.redirect).searchParams.get('code');
    const tokenRes = await agent
      .post('/api/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: 'http://localhost:9999/cb',
        client_id: clientId,
        code_verifier: 'wrong-verifier',
      })
      .expect(200);
    expect(tokenRes.body.error).toBe('invalid_grant');
  });

  it('discovery endpoints are public', async () => {
    const anon = h.agent();
    const r1 = await anon.get('/api/.well-known/oauth-protected-resource').expect(200);
    expect(r1.body.authorization_servers).toBeTruthy();
    const r2 = await anon.get('/api/.well-known/oauth-authorization-server').expect(200);
    expect(r2.body.token_endpoint).toContain('/oauth/token');
  });
});
