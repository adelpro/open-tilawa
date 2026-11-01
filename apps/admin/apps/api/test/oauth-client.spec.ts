import { OAuthClient, OAuthProviderError, type OAuthHttp } from '../src/auth/oauth/oauth.client';
import { providerConfig, type OAuthProviderName } from '../src/auth/oauth/oauth.config';

const env = (values: Record<string, string>) => (key: string) => values[key];

const config = (name: OAuthProviderName) =>
  providerConfig(
    name,
    env({
      GOOGLE_CLIENT_ID: 'google-id',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      GITHUB_CLIENT_ID: 'github-id',
      GITHUB_CLIENT_SECRET: 'github-secret',
      WEBSITE: 'https://console.tilawah.cc',
    }),
  )!;

const json = (value: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(value),
});

/** A fetch stub that answers by URL fragment, and records what was called. */
function stubHttp(routes: { token?: unknown; google?: unknown; user?: unknown; emails?: unknown }) {
  const calls: string[] = [];
  const http: OAuthHttp = async (url) => {
    calls.push(url);
    if (url.includes('/token') || url.includes('/access_token')) {
      return json(routes.token ?? { access_token: 'token' });
    }
    if (url.includes('openidconnect.googleapis.com')) return json(routes.google ?? {});
    if (url.includes('/user/emails')) return json(routes.emails ?? []);
    if (url.includes('api.github.com/user')) return json(routes.user ?? {});
    throw new Error(`unexpected url ${url}`);
  };
  return { http, calls };
}

describe('oauth client', () => {
  it('asks Google to choose an account and both providers for the same callback shape', () => {
    const { http } = stubHttp({});
    const client = new OAuthClient(http);

    const google = new URL(client.authorizeUrl(config('google'), 'nonce', env({})));
    const github = new URL(client.authorizeUrl(config('github'), 'nonce', env({})));

    expect(google.searchParams.get('prompt')).toBe('select_account');
    expect(github.searchParams.has('prompt')).toBe(false);
    expect(google.searchParams.get('redirect_uri')).toBe(
      'http://localhost:9320/api/auth/google/callback',
    );
    expect(google.searchParams.get('state')).toBe('nonce');
  });

  it('carries Google verification rather than assuming it', async () => {
    const { http } = stubHttp({
      google: { sub: 'g-1', email: 'a@example.com', email_verified: false, name: 'A' },
    });
    const identity = await new OAuthClient(http).identity(config('google'), 'code', env({}));

    expect(identity).toMatchObject({
      provider: 'google',
      subject: 'g-1',
      email: 'a@example.com',
      emailVerified: false,
    });
  });

  it('reads the primary verified address from GitHub emails, not the public field', async () => {
    const { http } = stubHttp({
      user: { id: 9001, login: 'octocat', name: null, email: 'public@example.com' },
      emails: [
        { email: 'old@example.com', primary: false, verified: true },
        { email: 'primary@example.com', primary: true, verified: true },
      ],
    });
    const identity = await new OAuthClient(http).identity(config('github'), 'code', env({}));

    expect(identity).toMatchObject({
      provider: 'github',
      subject: '9001',
      email: 'primary@example.com',
      emailVerified: true,
      name: 'octocat',
    });
  });

  it('refuses a GitHub account with no verified address', async () => {
    const { http } = stubHttp({
      user: { id: 9001, login: 'octocat' },
      emails: [{ email: 'unverified@example.com', primary: true, verified: false }],
    });

    await expect(new OAuthClient(http).identity(config('github'), 'code', env({}))).rejects.toMatchObject({
      code: 'email_unavailable',
    });
  });

  it('turns a non-JSON token answer into a provider error, not a crash', async () => {
    const http: OAuthHttp = async () => ({
      ok: true,
      status: 200,
      text: async () => 'access_token=form-encoded',
    });

    await expect(
      new OAuthClient(http).identity(config('google'), 'code', env({})),
    ).rejects.toBeInstanceOf(OAuthProviderError);
  });
});
