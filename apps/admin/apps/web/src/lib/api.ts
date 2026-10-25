/**
 * The only place the dashboard talks to the API.
 *
 * Two rules live here. Every request carries `credentials: 'include'` — the
 * session is an httpOnly cookie, so nothing in JS can hold it. And every
 * state-changing request carries the CSRF header from `/api/csrf`, fetched once
 * and refreshed on demand, because a mutation without it is a 403 by design.
 */

import { deviceId } from './device';

const CSRF_HEADER = 'x-csrf-token';

let csrfToken: string | null = null;
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function csrf(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch('/api/csrf', { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'Could not obtain a CSRF token');
  const body = (await res.json()) as { token: string };
  csrfToken = body.token;
  return csrfToken;
}

/** Called after a 403 so the next attempt uses a fresh token rather than the stale one. */
export function resetCsrf(): void {
  csrfToken = null;
}

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = { Accept: 'application/json' };

  // The device identity travels on every call: the API uses it to remember which
  // devices have already passed a 2FA challenge, so a trusted device is not asked
  // twice.
  headers['X-Fingerprint'] = deviceId();

  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (MUTATING.has(method)) headers[CSRF_HEADER] = await csrf();

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (res.status === 403) resetCsrf();

  // A JSON API can answer with `index.html` when a request is routed to the SPA
  // instead of to the API — a wrong host, a missing proxy rule, a stale bookmark.
  // Parsing that as data produced messages like `Unexpected token '<'`, so the
  // mistake is named instead.
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('text/html') && !path.endsWith('.html')) {
    throw new ApiError(
      res.status,
      'The server answered with a page rather than data. Check the address, or whether the API is reachable from here.',
    );
  }

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(parsed, res.status), parsed);
  }
  return parsed as T;
}

/**
 * An upload: the body is the image itself, not JSON.
 *
 * Separate from `api()` because it must not set `Content-Type: application/json`
 * and must not stringify — the bytes go up as they came out of the canvas.
 */
export async function apiUpload<T>(path: string, blob: Blob, mime = 'image/jpeg'): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': mime,
    Accept: 'application/json',
    'X-Fingerprint': deviceId(),
    [CSRF_HEADER]: await csrf(),
  };

  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: blob,
  });

  if (res.status === 403) resetCsrf();

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : null;
  if (!res.ok) throw new ApiError(res.status, messageFrom(parsed, res.status), parsed);
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Nest answers `{ message: string | string[] }`; both shapes reach the user as prose. */
function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object' && 'message' in body) {
    const value = (body as { message: unknown }).message;
    if (Array.isArray(value)) return value.join('. ');
    if (typeof value === 'string') return value;
  }
  if (status === 401) return 'You are not signed in.';
  if (status === 403) return 'That request was refused.';
  if (status === 404) return 'Not found.';
  return `Request failed (${status}).`;
}
