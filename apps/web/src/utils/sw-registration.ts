/**
 * The service worker is registered at startup, not on first playback: it is the
 * app shell's offline copy as well as the torrent stream's origin, so a page
 * without a controller is a page where `file.streamURL` cannot exist.
 *
 * Updates take the standard path — the worker calls `skipWaiting()` and
 * `clientsClaim()`, and this module reloads once the *new* worker takes control.
 * The reload is guarded twice: only when a controller already existed (a first
 * install claiming the page must not reload it) and only once per page.
 */
const SW_URL = import.meta.env.DEV ? '/dev-sw.js?dev-sw' : '/sw.js';

let pending: Promise<ServiceWorkerRegistration | undefined> | null = null;
let reloading = false;

export function registerAppWorker(): Promise<ServiceWorkerRegistration | undefined> {
  if (pending) return pending;
  if (!('serviceWorker' in navigator)) return Promise.resolve(undefined);

  const hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });

  pending = (async () => {
    try {
      const registration = await navigator.serviceWorker.register(
        SW_URL,
        import.meta.env.DEV ? { scope: '/', type: 'module' } : { scope: '/' },
      );
      // Ask once per load: a tab left open for days should still pick up a deploy.
      void registration.update?.().catch(() => undefined);
      return registration;
    } catch (error) {
      console.error('service worker registration failed:', error);
      return undefined;
    }
  })();

  return pending;
}

/** Resolves with an active registration, or after `timeoutMs` without one. */
export async function whenWorkerReady(
  timeoutMs = 5_000,
): Promise<ServiceWorkerRegistration | undefined> {
  const registration = await registerAppWorker();
  if (!registration) return undefined;

  await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((resolve) => setTimeout(resolve, timeoutMs)),
  ]);

  return registration;
}
