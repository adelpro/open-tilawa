/**
 * Scopes a key can carry. A key without a required scope must fail as a domain
 * error inside the tool response, not as a 500 — the caller can act on "you
 * cannot do that", and nothing at all on "something broke".
 */
export const SCOPES = ['profile:read', 'profile:write', 'gate:run'] as const;

export type Scope = (typeof SCOPES)[number];

/** What a key gets when the caller does not choose: read-only. */
export const DEFAULT_SCOPES: Scope[] = ['profile:read'];

export function isScope(value: string): value is Scope {
  return (SCOPES as readonly string[]).includes(value);
}

/** Stored as a comma-separated string; unknown entries are dropped, not trusted. */
export function parseScopes(value: string | null | undefined): Scope[] {
  if (!value) return [];
  return value
    .split(',')
    .map((scope) => scope.trim())
    .filter(isScope);
}

export function formatScopes(scopes: Scope[]): string {
  return scopes.filter(isScope).join(',');
}

export function hasScope(granted: Scope[], required: Scope): boolean {
  return granted.includes(required);
}
