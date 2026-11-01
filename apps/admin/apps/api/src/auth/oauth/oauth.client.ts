import { Inject, Injectable } from '@nestjs/common';
import { callbackUrl, type ProviderConfig } from './oauth.config';

/** Injected so tests can answer as a provider without a network or a browser. */
export const OAUTH_HTTP = 'TILAWA_OAUTH_HTTP';

export interface OAuthResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export type OAuthHttp = (url: string, init: RequestInit) => Promise<OAuthResponse>;

/**
 * What a provider tells us about a person.
 *
 * `emailVerified` is carried, not assumed. It is the single field that decides whether
 * an address may be matched against an existing account, so a provider that cannot
 * claim it must fail the flow rather than pass a weaker identity through.
 */
export interface OAuthIdentity {
  provider: 'google' | 'github';
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

/** A provider failure with a code the controller can turn into a redirect. */
export class OAuthProviderError extends Error {
  constructor(
    readonly code:
      'provider_disabled' | 'token_exchange_failed' | 'profile_fetch_failed' | 'email_unavailable',
    message: string,
  ) {
    super(message);
  }
}

export const defaultOAuthHttp: OAuthHttp = (url, init) =>
  fetch(url, init) as unknown as Promise<OAuthResponse>;

/**
 * One provider call is allowed to be flaky; the flow is not.
 *
 * GitHub's edge intermittently drops the SYN from this network (`UND_ERR_CONNECT_TIMEOUT`),
 * and a single dropped connection used to end the sign-in with "provider could not
 * complete". Three attempts with an 8s bound each recover the common case and still
 * fail in the time a person will wait.
 */
const PROVIDER_TIMEOUT_MS = 8_000;
const PROVIDER_ATTEMPTS = 3;

const retryable = (error: unknown): boolean => {
  const code =
    (error as { cause?: { code?: string } })?.cause?.code ?? (error as { code?: string })?.code;
  const name = (error as Error)?.name;
  return (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    name === 'TimeoutError' ||
    name === 'AbortError'
  );
};

const detailOf = (error: unknown): string =>
  (error as { cause?: { code?: string } })?.cause?.code ??
  (error as Error)?.message ??
  'unknown error';

@Injectable()
export class OAuthClient {
  constructor(@Inject(OAUTH_HTTP) private readonly http: OAuthHttp) {}

  authorizeUrl(config: ProviderConfig, state: string, env: (key: string) => string | undefined) {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: callbackUrl(config.name, env),
      response_type: 'code',
      scope: config.scope,
      state,
    });

    // Google re-prompts account choice, which is what a person expects from a
    // "continue with" button; GitHub has no equivalent parameter.
    if (config.name === 'google') {
      params.set('prompt', 'select_account');
      params.set('access_type', 'online');
    }

    return `${config.authorizeUrl}?${params.toString()}`;
  }

  /** Exchange the code and read the identity. One call, so a failure has one shape. */
  async identity(
    config: ProviderConfig,
    code: string,
    env: (key: string) => string | undefined,
  ): Promise<OAuthIdentity> {
    const accessToken = await this.exchange(config, code, env);
    return config.name === 'google'
      ? this.googleIdentity(accessToken)
      : this.githubIdentity(accessToken);
  }

  /**
   * A provider call with a deadline and a retry. HTTP failures are not retried here —
   * they are answers, not accidents — only connections that never produced one.
   */
  private async request(
    url: string,
    init: RequestInit,
    failure: 'token_exchange_failed' | 'profile_fetch_failed',
  ): Promise<OAuthResponse> {
    let last: unknown;
    for (let attempt = 0; attempt < PROVIDER_ATTEMPTS; attempt += 1) {
      try {
        return await this.http(url, {
          ...init,
          signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
        });
      } catch (error) {
        last = error;
        if (!retryable(error)) break;
      }
    }
    throw new OAuthProviderError(
      failure,
      `${new URL(url).host} was unreachable: ${detailOf(last)}`,
    );
  }

  private async exchange(
    config: ProviderConfig,
    code: string,
    env: (key: string) => string | undefined,
  ): Promise<string> {
    const response = await this.request(config.tokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        accept: 'application/json',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl(config.name, env),
      }).toString(),
    }, 'token_exchange_failed');

    const raw = await response.text();
    if (!response.ok) {
      throw new OAuthProviderError(
        'token_exchange_failed',
        `${config.name} refused the code (${response.status})`,
      );
    }

    let body: { access_token?: string; error?: string };
    try {
      body = JSON.parse(raw) as { access_token?: string; error?: string };
    } catch {
      // GitHub answers form-encoded unless asked otherwise; a body that is not JSON
      // means the request was refused before the token endpoint.
      throw new OAuthProviderError(
        'token_exchange_failed',
        `${config.name} answered with something other than JSON`,
      );
    }

    if (!body.access_token) {
      throw new OAuthProviderError(
        'token_exchange_failed',
        `${config.name} returned no access token${body.error ? `: ${body.error}` : ''}`,
      );
    }
    return body.access_token;
  }

  private async googleIdentity(accessToken: string): Promise<OAuthIdentity> {
    const response = await this.request(
      'https://openidconnect.googleapis.com/v1/userinfo',
      {
        method: 'GET',
        headers: { authorization: `Bearer ${accessToken}`, accept: 'application/json' },
      },
      'profile_fetch_failed',
    );
    const raw = await response.text();
    if (!response.ok) {
      throw new OAuthProviderError('profile_fetch_failed', 'google profile request failed');
    }

    const profile = JSON.parse(raw) as {
      sub?: string;
      email?: string;
      email_verified?: boolean;
      name?: string;
      given_name?: string;
    };

    if (!profile.sub || !profile.email) {
      throw new OAuthProviderError('email_unavailable', 'google returned no subject or email');
    }

    return {
      provider: 'google',
      subject: profile.sub,
      email: profile.email,
      // `email_verified` is a real boolean in Google's userinfo response; absent is
      // treated as unverified, never as true.
      emailVerified: profile.email_verified === true,
      name: profile.name?.trim() || profile.given_name?.trim() || profile.email.split('@')[0],
    };
  }

  private async githubIdentity(accessToken: string): Promise<OAuthIdentity> {
    const headers = {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/vnd.github+json',
      'user-agent': 'tilawa-admin',
    };

    const [userResponse, emailResponse] = await Promise.all([
      this.request('https://api.github.com/user', { method: 'GET', headers }, 'profile_fetch_failed'),
      this.request(
        'https://api.github.com/user/emails',
        { method: 'GET', headers },
        'profile_fetch_failed',
      ),
    ]);

    if (!userResponse.ok) {
      throw new OAuthProviderError('profile_fetch_failed', 'github profile request failed');
    }

    const user = JSON.parse(await userResponse.text()) as {
      id?: number;
      login?: string;
      name?: string;
      email?: string | null;
    };

    // The profile's `email` field is the *public* address and may be absent or unverified.
    // The emails endpoint is the authority: primary and verified is the address a
    // provider is actually asserting.
    let email: string | null = null;
    let verified = false;
    if (emailResponse.ok) {
      const emails = JSON.parse(await emailResponse.text()) as {
        email?: string;
        primary?: boolean;
        verified?: boolean;
      }[];
      const chosen =
        emails.find((entry) => entry.primary && entry.verified) ??
        emails.find((entry) => entry.verified);
      if (chosen?.email) {
        email = chosen.email;
        verified = true;
      }
    }

    if (!user.id) {
      throw new OAuthProviderError('profile_fetch_failed', 'github returned no account id');
    }
    if (!email) {
      // A GitHub account with no verified address cannot be matched or created: the
      // address would be an assertion nobody made.
      throw new OAuthProviderError(
        'email_unavailable',
        'github has no verified email address for this account',
      );
    }

    return {
      provider: 'github',
      subject: String(user.id),
      email,
      emailVerified: verified,
      name: user.name?.trim() || user.login?.trim() || email.split('@')[0],
    };
  }
}
