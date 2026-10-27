import { gun } from './index';
import { getGunKeys } from '@/constants/gun-keys';

/**
 * The two public counters. Both live outside `gun.user()` on purpose: they are
 * anonymous totals, readable by everyone, writable by anyone. The user's own
 * list lives in `gun.user().get('favorites')` and never touches these nodes.
 */
export type CountKind = 'view' | 'favorite';
export type Counts = Record<string, number>;

const keys = getGunKeys();

const store: Record<CountKind, Counts> = { view: {}, favorite: {} };
const listeners: Record<CountKind, Set<(counts: Counts) => void>> = {
  view: new Set(),
  favorite: new Set(),
};
const started: Record<CountKind, boolean> = { view: false, favorite: false };

function graphFor(kind: CountKind) {
  return gun.get(kind === 'view' ? keys.viewCounts : keys.favoriteCounts);
}

/** A node may hold `{ count: n }` or a bare `n`; both are accepted. */
function readCount(data: unknown): number {
  if (typeof data === 'number' && Number.isFinite(data)) return Math.max(0, data);
  const count = (data as { count?: unknown } | null)?.count;
  if (typeof count === 'number' && Number.isFinite(count)) return Math.max(0, count);
  return 0;
}

/**
 * One subscription per counter, shared by every component that asks for it.
 * Gun's map listener cannot be removed per-callback, so starting a second one
 * per mount would leak a node for every sheet open.
 */
function start(kind: CountKind) {
  if (started[kind]) return;
  started[kind] = true;
  graphFor(kind)
    .map()
    .on((data: unknown, key: string) => {
      if (!key || key === '_') return;
      store[kind] = { ...store[kind], [key]: readCount(data) };
      listeners[kind].forEach((cb) => cb(store[kind]));
    });
}

export function subscribeCounts(kind: CountKind, cb: (counts: Counts) => void): () => void {
  start(kind);
  listeners[kind].add(cb);
  cb(store[kind]);
  return () => {
    listeners[kind].delete(cb);
  };
}

export function readCounts(kind: CountKind): Counts {
  return store[kind];
}

/**
 * Read-modify-write, serialised per id.
 *
 * Two bumps for the same reciter in quick succession used to tie on Gun's
 * millisecond state clock: the relay kept the newer value while the tab's own
 * view stayed on the older one until a reload. Chaining the bumps removes the
 * tie, and publishing what we actually wrote keeps the UI honest without
 * waiting for an echo.
 */
const chains = new Map<string, Promise<void>>();

function publish(kind: CountKind, id: string, value: number): void {
  if (store[kind][id] === value) return;
  store[kind] = { ...store[kind], [id]: value };
  listeners[kind].forEach((cb) => cb(store[kind]));
}

function bump(kind: CountKind, id: string, delta: 1 | -1): void {
  const key = `${kind}:${id}`;
  const previous = chains.get(key) ?? Promise.resolve();
  const next = previous.then(
    () =>
      new Promise<void>((resolve) => {
        const node = graphFor(kind).get(id);
        node.get('count').once((current: unknown) => {
          const value = Math.max(0, readCount(current) + delta);
          node.get('count').put(value);
          publish(kind, id, value);
          resolve();
        });
      }),
  );
  chains.set(key, next);
}

export function syncView(reciterId: string | number): void {
  bump('view', String(reciterId), 1);
}

export function syncFavorite(reciterId: string | number, add: boolean): void {
  bump('favorite', String(reciterId), add ? 1 : -1);
}
