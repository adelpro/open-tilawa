import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { Button } from '../components/Button';
import { Notice } from '../components/Chip';
import { Icon } from '../components/icons';

/** What the server derives for one consent request. */
type Intent = {
  valid: boolean;
  client_id?: string;
  client_name?: string;
  redirect_uri?: string;
  scope?: string;
  error?: string;
};

/**
 * OAuth 2.1 consent screen for MCP clients.
 *
 * The authorization server redirects here with the request parameters in the query
 * string. Who is asking and what they get is NOT read from that query for display:
 * a crafted link could spell any branding it liked (phishing signage). Instead the
 * screen asks the server for the signed-in user's intent for this exact triple --
 * client_id/redirect/scope -- and renders (and posts back) only those server-derived
 * values. A screen whose inputs answer invalid shows a plain error and never
 * renders the link's own claims.
 */
export function OAuthConsent(): ReactElement {
  const { t } = useI18n();
  const params = new URLSearchParams(window.location.search);
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const scope = params.get('scope') ?? '';
  const state = params.get('state') ?? '';
  const codeChallenge = params.get('code_challenge') ?? '';

  const [intent, setIntent] = useState<Intent | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      ...(scope ? { scope } : {}),
    });
    api('/oauth/authorize/intent?' + query.toString()).then(
      (value) => setIntent(value as Intent),
      () => setIntent({ valid: false, error: 'unreachable' }),
    );
    // The request triple is fixed at page load; it is not a live input.
  }, []);

  const approve = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (!intent?.valid || !intent.client_id || !intent.redirect_uri) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ redirect: string }>('/oauth/authorize/approve', {
        method: 'POST',
        body: {
          client_id: intent.client_id,
          redirect_uri: intent.redirect_uri,
          scope: intent.scope ?? '',
          state,
          code_challenge: codeChallenge,
        },
      });
      window.location.href = result.redirect;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t('oauth.failed'));
    } finally {
      setBusy(false);
    }
  };

  /** Denial returns to a REGISTERED redirect only. */
  const deny = (): void => {
    if (!intent?.valid || !intent.redirect_uri) return;
    const url = new URL(intent.redirect_uri);
    url.searchParams.set('error', 'access_denied');
    if (state) url.searchParams.set('state', state);
    window.location.href = url.toString();
  };

  const scopes = (intent?.scope ?? '').split(/\s+/).filter(Boolean);
  const clientName = intent?.client_name ?? '';

  return (
    <div className="auth">
      <div className="auth__card stack">
        <div>
          <h1 className="display-lg">{t('oauth.title')}</h1>
          <p className="body muted">{t('oauth.lede', { client: clientName })}</p>
        </div>

        {!intent ? (
          <p className="fine-print">...</p>
        ) : !intent.valid ? (
          <Notice tone="bad">{t('oauth.failed')}</Notice>
        ) : (
          <>
            <div className="stack stack--tight">
              <p className="fine-print">{t('oauth.wants')}</p>
              <ul className="stack stack--tight">
                {scopes.length > 0 ? (
                  scopes.map((s) => (
                    <li key={s} className="cluster" style={{ gap: 'var(--space-2)' }}>
                      <Icon name="check" size={16} />
                      <span>{s}</span>
                    </li>
                  ))
                ) : (
                  <li className="cluster" style={{ gap: 'var(--space-2)' }}>
                    <Icon name="check" size={16} />
                    <span>{t('oauth.basicAccess')}</span>
                  </li>
                )}
              </ul>
            </div>

            <p className="fine-print">{t('oauth.privacy')}</p>

            <div className="cluster">
              <Button
                type="submit"
                onClick={(e) => void approve(e as unknown as FormEvent)}
                busy={busy}
              >
                {t('oauth.approve')}
              </Button>
              <Button variant="tertiary" onClick={deny} disabled={busy}>
                {t('oauth.deny')}
              </Button>
            </div>
          </>
        )}

        {error ? <Notice tone="bad">{error}</Notice> : null}
      </div>
    </div>
  );
}
