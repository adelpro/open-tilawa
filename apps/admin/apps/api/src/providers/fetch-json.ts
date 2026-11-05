/** A provider answered, but not with 2xx. */
export class ProviderHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderHttpError';
  }
}

/**
 * One JSON request with a hard timeout.
 *
 * Network errors and 5xx get one retry; a 4xx is the provider telling us the
 * request itself is wrong, so it is surfaced immediately. The console shows the
 * message, which is why the provider's own text is kept.
 */
export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; attempts?: number } = {},
): Promise<T> {
  const timeoutMs = options.timeoutMs ?? 10_000;
  const attempts = options.attempts ?? 2;
  let last: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return (await response.json()) as T;

      const detail = await response.text().catch(() => '');
      const message = `provider answered ${response.status}${detail ? `: ${detail.slice(0, 160)}` : ''}`;
      if (response.status >= 400 && response.status < 500) {
        throw new ProviderHttpError(response.status, message);
      }
      last = new ProviderHttpError(response.status, message);
    } catch (err) {
      if (err instanceof ProviderHttpError) throw err;
      last = err;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }

  throw last instanceof Error ? last : new Error(String(last));
}
