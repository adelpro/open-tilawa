/**
 * Provider configuration, read from the environment.
 *
 * A provider is **configured** only when both halves of its credential exist. That is
 * the one fact the sign-in screen needs: a button for a provider that cannot complete
 * the round trip is a dead end, so an unconfigured provider is not offered at all
 * rather than failing after the redirect.
 */
export type OAuthProviderName = 'google' | 'github';

export interface ProviderConfig {
  name: OAuthProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
}

export type EnvReader = (key: string) => string | undefined;

const PROVIDERS: Record<
  OAuthProviderName,
  { idKey: string; secretKey: string; authorizeUrl: string; tokenUrl: string; scope: string }
> = {
  google: {
    idKey: 'GOOGLE_CLIENT_ID',
    secretKey: 'GOOGLE_CLIENT_SECRET',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scope: 'openid email profile',
  },
  github: {
    idKey: 'GITHUB_CLIENT_ID',
    secretKey: 'GITHUB_CLIENT_SECRET',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    scope: 'read:user user:email',
  },
};

export const PROVIDER_NAMES: OAuthProviderName[] = ['google', 'github'];

export const isProviderName = (value: string): value is OAuthProviderName =>
  PROVIDER_NAMES.includes(value as OAuthProviderName);

export function providerConfig(name: OAuthProviderName, env: EnvReader): ProviderConfig | null {
  const spec = PROVIDERS[name];
  const clientId = env(spec.idKey)?.trim();
  const clientSecret = env(spec.secretKey)?.trim();
  if (!clientId || !clientSecret) return null;

  return {
    name,
    clientId,
    clientSecret,
    authorizeUrl: spec.authorizeUrl,
    tokenUrl: spec.tokenUrl,
    scope: spec.scope,
  };
}

/** Which providers this deployment can actually complete. */
export function configuredProviders(env: EnvReader): OAuthProviderName[] {
  return PROVIDER_NAMES.filter((name) => providerConfig(name, env) !== null);
}

/**
 * The callback URL registered with the provider.
 *
 * Derived from `WEBSITE` — the same value the mail links use — so there is one place
 * to change the hostname and no second variable that can silently disagree with it.
 */
export function callbackUrl(name: OAuthProviderName, env: EnvReader): string {
  const base = (env('WEBSITE') ?? 'http://localhost:9300').replace(/\/+$/, '');
  return `${base}/api/auth/${name}/callback`;
}
