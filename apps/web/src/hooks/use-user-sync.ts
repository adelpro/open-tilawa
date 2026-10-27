import { useCallback, useEffect } from 'react';
import { useAtom, useAtomValue } from 'jotai';

import { user } from '@/gun';
import {
  gunUserPubAtom,
  myFavoritesAtom,
  myFavMetaAtom,
  userDevicesAtom,
  userDevicesMetaAtom,
  userCurrentReciterAtom,
  userCurrentSurahAtom,
  userProgressAtom,
  userProfileAtom,
} from '@/jotai/gun';
import { getOrCreateDeviceId } from '@/utils/device/device-id';
import { getOrCreateDeviceName } from '@/utils/device/device-name';
import { readLocalFavorites, writeLocalFavorites } from '@/utils/favorites-local';

/**
 * Bounded read: an empty node may never answer `.once()`, and the login
 * snapshot must not wait on it forever.
 */
function once<T = any>(node: any, timeout = 1500): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: T | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), timeout);
    try {
      node.once((data: T) => {
        clearTimeout(timer);
        finish(data ?? null);
      });
    } catch {
      clearTimeout(timer);
      finish(null);
    }
  });
}

/** Writes this device's row so every linked device can see it in the list. */
export function touchDevice(name?: string): void {
  if (!user.is) return;
  try {
    const deviceId = getOrCreateDeviceId();
    user
      .get('devices')
      .get(deviceId)
      .put({
        id: deviceId,
        name: name || getOrCreateDeviceName(),
        pub: user.is.pub,
        lastSeen: Date.now(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      });

    // The first device to register claims "primary". Never overwritten, so a
    // later device cannot take the badge.
    user
      .get('devices')
      .get('meta')
      .once((meta: { primaryPub?: string } | undefined) => {
        if (meta?.primaryPub) return;
        user
          .get('devices')
          .get('meta')
          .put({ primaryPub: user.is?.pub, createdAt: Date.now() });
      });
  } catch {
    // offline or relay down: the next touch retries
  }
}

/**
 * Mirrors the account graph into atoms. Mount once (App), never per component:
 * every `.map().on()` here is a live relay subscription.
 */
export function useUserSync() {
  const pub = useAtomValue(gunUserPubAtom);
  const [favorites, setFavorites] = useAtom(myFavoritesAtom);
  const [, setFavMeta] = useAtom(myFavMetaAtom);
  const [, setDevices] = useAtom(userDevicesAtom);
  const [, setDevicesMeta] = useAtom(userDevicesMetaAtom);
  const [, setCurrentReciter] = useAtom(userCurrentReciterAtom);
  const [, setCurrentSurah] = useAtom(userCurrentSurahAtom);
  const [, setProgress] = useAtom(userProgressAtom);
  const [, setProfile] = useAtom(userProfileAtom);

  useEffect(() => {
    if (!pub || !user.is) return;

    let cancelled = false;
    const nodes: any[] = [];

    const watch = (node: any, cb: (value: any, key: string) => void) => {
      nodes.push(node);
      node.on(cb);
    };

    // Snapshot first: a `.on()` alone replays late, and the UI would flash empty.
    void (async () => {
      const remote = await once(user.get('favorites'));
      if (cancelled) return;
      const remoteIds =
        remote && typeof remote === 'object'
          ? Object.entries(remote)
              .filter(([k, v]) => k !== '_' && v === true)
              .map(([k]) => k)
          : [];

      // Union, never replace: local favourites made while logged out survive.
      const merged = Array.from(new Set([...readLocalFavorites(), ...remoteIds]));
      writeLocalFavorites(merged);
      setFavorites(merged);
      merged.forEach((id) => {
        if (!remoteIds.includes(id)) user.get('favorites').get(id).put(true);
      });

      const [meta, devs, dmeta, cr, cs, pr, prof] = await Promise.all([
        once(user.get('favMeta')),
        once(user.get('devices')),
        once(user.get('devices').get('meta')),
        once(user.get('reciter')),
        once(user.get('surah')),
        once(user.get('progress')),
        once(user.get('profile')),
      ]);
      if (cancelled) return;

      if (meta && typeof meta === 'object') setFavMeta((prev) => ({ ...meta, ...prev }));
      // Merge, never replace: the snapshot can resolve after this device has
      // already written its own row, and a replace would erase it.
      if (devs && typeof devs === 'object') setDevices((prev) => ({ ...devs, ...prev }));
      if (dmeta && typeof dmeta === 'object') setDevicesMeta((prev) => ({ ...dmeta, ...prev }));
      if (typeof cr === 'number') setCurrentReciter(cr);
      if (typeof cs === 'number') setCurrentSurah(cs);
      // Position is last-write-wins, so the newer stamp wins whichever side it
      // came from.
      if (pr && typeof pr === 'object') {
        setProgress((prev) =>
          prev && (prev.updatedAt ?? 0) > (pr.updatedAt ?? 0) ? prev : pr,
        );
      }
      if (prof && typeof prof === 'object') setProfile((prev) => ({ ...prof, ...prev }));
    })();

    watch(user.get('favorites').map(), (val: any, key: string) => {
      if (key === '_') return;
      setFavorites((prev) => {
        const has = prev.includes(key);
        if (val === true && !has) return [...prev, key];
        if (val !== true && has) return prev.filter((f) => f !== key);
        return prev;
      });
    });

    watch(user.get('favMeta').map(), (val: any, key: string) => {
      if (key === '_' || !val || typeof val !== 'object') return;
      setFavMeta((prev) => ({ ...prev, [key]: val }));
    });

    watch(user.get('devices').map(), (val: any, key: string) => {
      if (key === '_' || key === 'meta' || !val || typeof val !== 'object') return;
      setDevices((prev) => ({ ...prev, [key]: val }));
    });

    watch(user.get('devices').get('meta'), (val: any) => {
      if (val && typeof val === 'object') setDevicesMeta(val);
    });

    watch(user.get('reciter'), (val: any) => {
      if (typeof val === 'number') setCurrentReciter(val);
    });

    watch(user.get('surah'), (val: any) => {
      if (typeof val === 'number') setCurrentSurah(val);
    });

    watch(user.get('progress'), (val: any) => {
      if (val && typeof val === 'object') setProgress(val);
    });

    watch(user.get('profile'), (val: any) => {
      if (val && typeof val === 'object') setProfile(val);
    });

    touchDevice();
    const heartbeat = setInterval(() => touchDevice(), 120_000);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      nodes.forEach((node) => {
        try {
          node.off();
        } catch {
          // already gone
        }
      });
    };
  }, [pub, setFavorites, setFavMeta, setDevices, setDevicesMeta, setCurrentReciter, setCurrentSurah, setProgress, setProfile]);

  const setCurrentReciterId = useCallback((reciterId: number) => {
    if (!user.is) return;
    user.get('reciter').put(reciterId);
    touchDevice();
  }, []);

  const setCurrentSurahId = useCallback((surahId: number) => {
    if (!user.is) return;
    user.get('surah').put(surahId);
  }, []);

  const setProgressState = useCallback((p: { surahId?: number; position?: number }) => {
    if (!user.is) return;
    user.get('progress').put({ ...p, updatedAt: Date.now() });
  }, []);

  const updateProfile = useCallback((p: { displayName?: string; avatarUrl?: string }) => {
    if (!user.is) return;
    user.get('profile').once((current: any) => {
      user.get('profile').put({ ...(current || {}), ...p, updatedAt: Date.now() });
    });
  }, []);

  const updateDeviceName = useCallback((deviceId: string, name: string) => {
    if (!user.is) return;
    user.get('devices').get(deviceId).put({ name: name.trim() || 'Device', lastSeen: Date.now() });
  }, []);

  return {
    favorites,
    setCurrentReciterId,
    setCurrentSurahId,
    setProgressState,
    updateProfile,
    updateDeviceName,
  };
}
