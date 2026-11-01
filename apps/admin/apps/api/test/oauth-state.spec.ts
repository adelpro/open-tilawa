import {
  callbackUrl,
  configuredProviders,
  isProviderName,
  providerConfig,
  type EnvReader,
} from '../src/auth/oauth/oauth.config';
import {
  OAUTH_STATE_TTL_MS,
  createState,
  verifyState,
} from '../src/auth/oauth/oauth.state';

/**
 * The two pieces that must be right before any provider is contacted: what a
 * deployment can offer, and whether a returned state is the one we issued.
 */
describe('provider configuration', () => {
  const env = (values: Record<string, string>): EnvReader => (key) => values[key];

  it('offers a provider only when both halves of the credential exist', () => {
    expect(providerConfig('google', env({ GOOGLE_CLIENT_ID: 'id' }))).toBeNull();
    expect(providerConfig('google', env({ GOOGLE_CLIENT_SECRET: 'secret' }))).toBeNull();
    expect(providerConfig('google', env({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 'secret' })))
      .not.toBeNull();
  });

  it('lists Google before GitHub, and only the configured ones', () => {
    expect(configuredProviders(env({}))).toEqual([]);
    expect(configuredProviders(env({ GITHUB_CLIENT_ID: 'i', GITHUB_CLIENT_SECRET: 's' }))).toEqual([
      'github',
    ]);
    expect(
      configuredProviders(
        env({
          GOOGLE_CLIENT_ID: 'i',
          GOOGLE_CLIENT_SECRET: 's',
          GITHUB_CLIENT_ID: 'i',
          GITHUB_CLIENT_SECRET: 's',
        }),
      ),
    ).toEqual(['google', 'github']);
  });

  it('ignores an empty credential rather than treating it as present', () => {
    expect(providerConfig('google', env({ GOOGLE_CLIENT_ID: ' ', GOOGLE_CLIENT_SECRET: 's' })))
      .toBeNull();
  });

  it('derives the callback from WEBSITE without a trailing slash', () => {
    expect(
      callbackUrl('google', env({ WEBSITE: 'https://console.tilawah.cc/' })),
    ).toBe('https://console.tilawah.cc/api/auth/google/callback');
    expect(callbackUrl('github', env({}))).toBe(
      'http://localhost:9320/api/auth/github/callback',
    );
  });

  it('rejects a provider name it does not serve', () => {
    expect(isProviderName('google')).toBe(true);
    expect(isProviderName('facebook')).toBe(false);
  });
});

describe('signed state', () => {
  const secret = 'test-secret';
  const device = '0123456789abcdef0123456789abcdef';

  it('round-trips provider, device and link user', () => {
    const { state, cookie } = createState('google', secret, { device, userId: 7 });
    const verified = verifyState(cookie, state.nonce, 'google', secret);

    expect(verified?.device).toBe(device);
    expect(verified?.userId).toBe(7);
    expect(verified?.provider).toBe('google');
  });

  it('rejects a different nonce', () => {
    const { cookie } = createState('google', secret, { device });
    expect(verifyState(cookie, 'other', 'google', secret)).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const { state, cookie } = createState('google', secret, { device });
    const [, signature] = cookie.split('.');
    const forged = Buffer.from(JSON.stringify({ ...state, userId: 99 })).toString('base64url');
    expect(verifyState(`${forged}.${signature}`, state.nonce, 'google', secret)).toBeNull();
  });

  it('rejects a different secret and a different provider', () => {
    const { state, cookie } = createState('google', secret, { device });
    expect(verifyState(cookie, state.nonce, 'google', 'other-secret')).toBeNull();
    expect(verifyState(cookie, state.nonce, 'github', secret)).toBeNull();
  });

  it('rejects an expired state', () => {
    const now = 1_000;
    const { state, cookie } = createState('google', secret, { device, now });
    expect(verifyState(cookie, state.nonce, 'google', secret, now + OAUTH_STATE_TTL_MS + 1)).toBeNull();
  });

  it('rejects a device that is not the SPA id shape', () => {
    const { state, cookie } = createState('google', secret, { device: 'not-a-device' });
    expect(verifyState(cookie, state.nonce, 'google', secret)).toBeNull();
  });
});
