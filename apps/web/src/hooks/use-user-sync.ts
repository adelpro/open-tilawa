import { useCallback, useEffect } from 'react';
import { getDefaultStore, useAtom, useAtomValue } from 'jotai';

import { user } from '@/gun';
import { once } from '@/gun/once';
import {
  gunUserPubAtom,
  myFavoritesAtom,
  userDevicesAtom,
  userDevicesMetaAtom,
  userSettingsAtom,
} from '@/jotai/gun';
import { getOrCreateDeviceId } from '@/utils/device/device-id';
import { getOrCreateDeviceLinkedAt } from '@/utils/device/device-linked-at';
import { getOrCreateDeviceName } from '@/utils/device/device-name';
import { readLocalFavorites, writeLocalFavorites } from '@/utils/favorites-local';
import type { StoredSettings } from '@/hooks/use-persistence';

/**
 * Writes this device's row so every linked device can see it in the list.
 *
 * The row is also put into the atom straight away: waiting for the relay echo
 * left a freshly created ring showing «0 أجهزة» and «لا أجهزة مسجّلة بعد» for as
 * long as the round trip took — or forever, if the echo never came.
 */
export function touchDevice(name?: string): void {
  if (!user.is) return;
  const deviceId = getOrCreateDeviceId();
  const row = {
    id: deviceId,
    name: name || getOrCreateDeviceName(),
    pub: user.is.pub,
    lastSeen: Date.now(),
    // Written on every touch but never recomputed: the row is rewritten on the
    // heartbeat, and the join date has to stay the join date.
    linkedAt: getOrCreateDeviceLinkedAt(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
  };
  getDefaultStore().set(userDevicesAtom, (prev) => ({ ...prev, [deviceId]: row }));

  try {
    user.get('devices').get(deviceId).put(row);

    // The first device to register claims "primary". Never overwritten, so a
    // later device cannot take the badge.
    user
      .get('devices')
      .get('meta')
      .once((meta: { primaryPub?: string; primaryDeviceId?: string; createdAt?: number } | undefined) => {
        if (meta?.primaryDeviceId) return;
        if (meta?.primaryPub && !meta?.primaryDeviceId) {
          // Try to find which device has this pub
          user
            .get('devices')
            .once((all: Record<string, any>) => {
              if (!all) return;
              let foundId: string | null = null;
              Object.entries(all).forEach(([id, row]: [string, any]) => {
                if (id === '_' || id === 'meta') return;
                if (row?.pub === meta.primaryPub) {
                  if (!foundId || (row?.lastSeen || 0) > (all[foundId]?.lastSeen || 0)) {
                    foundId = id;
                  }
                }
              });
              if (foundId) {
                user
                  .get('devices')
                  .get('meta')
                  .put({ ...(meta || {}), primaryDeviceId: foundId });
              } else {
                user
                  .get('devices')
                  .get('meta')
                  .put({ ...(meta || {}), primaryDeviceId: deviceId });
              }
            });
          return;
        }
        user
          .get('devices')
          .get('meta')
          .put({ primaryDeviceId: deviceId, primaryPub: user.is?.pub, createdAt: Date.now() });
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
  const [, setFavorites] = useAtom(myFavoritesAtom);
  const [, setDevices] = useAtom(userDevicesAtom);
  const [, setDevicesMeta] = useAtom(userDevicesMetaAtom);
  const [, setSettings] = useAtom(userSettingsAtom);

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

      const [devs, dmeta, remoteSettings] = await Promise.all([
        once(user.get('devices')),
        once(user.get('devices').get('meta')),
        once(user.get('settings')),
      ]);
      if (cancelled) return;

      // Merge, never replace: the snapshot can resolve after this device has
      // already written its own row, and a replace would erase it.
      if (devs && typeof devs === 'object') setDevices((prev) => ({ ...devs, ...prev }));
      if (dmeta && typeof dmeta === 'object') setDevicesMeta((prev) => ({ ...dmeta, ...prev }));
      // Settings are last-write-wins on a stamp, not a blind merge: the relay
      // replays whatever it holds, and an older value must not undo a choice
      // this device made while the snapshot was in flight.
      if (remoteSettings && typeof remoteSettings === 'object') {
        const { _, ...incoming } = remoteSettings as Record<string, any>;
        setSettings((prev) => {
          const next = typeof incoming.updatedAt === 'number' ? incoming.updatedAt : 0;
          const current = typeof prev.updatedAt === 'number' ? prev.updatedAt : 0;
          return next >= current ? { ...prev, ...incoming } : prev;
        });
      }
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

    watch(user.get('devices').map(), (val: any, key: string) => {
      if (key === '_' || key === 'meta' || !val || typeof val !== 'object') return;
      setDevices((prev) => ({ ...prev, [key]: val }));
    });

    watch(user.get('devices').get('meta'), (val: any) => {
      if (val && typeof val === 'object') setDevicesMeta(val);
    });

    // A setting changed on another device lands without a reload. `_` is Gun's
    // metadata on the node, not a setting.
    watch(user.get('settings'), (val: any) => {
      if (!val || typeof val !== 'object') return;
      const { _, ...incoming } = val;
      setSettings((prev) => {
        const next = typeof incoming.updatedAt === 'number' ? incoming.updatedAt : 0;
        const current = typeof prev.updatedAt === 'number' ? prev.updatedAt : 0;
        return next >= current ? { ...prev, ...incoming } : prev;
      });
    });

    touchDevice();
    // Five minutes, and only while the tab is visible: `lastSeen` is a hint, and
    // a background tab writing forever is relay storage nobody reads.
    const heartbeat = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        touchDevice();
      }
    }, 5 * 60_000);

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
  }, [pub, setFavorites, setDevices, setDevicesMeta, setSettings]);

  /**
   * One write, no read-modify-write.
   *
   * The caller hands over the merged, stamped object (`patchSettings` builds
   * it), so two devices changing different fields in the same second each send
   * a complete picture. It also removes the old `.once()` gate: on a node the
   * relay has never seen, that callback could simply never fire, which is how
   * the first settings write of a fresh account went missing.
   */
  const updateSettings = useCallback((p: StoredSettings) => {
    if (!user.is) return;
    try {
      user.get('settings').put({
        ...p,
        updatedAt: typeof p.updatedAt === 'number' ? p.updatedAt : Date.now(),
      });
    } catch {
      // offline: the local state already holds it
    }
  }, []);

  const updateDeviceName = useCallback((deviceId: string, name: string) => {
    if (!user.is) return;
    user.get('devices').get(deviceId).put({ name: name.trim() || 'Device', lastSeen: Date.now() });
  }, []);

  return {
    updateDeviceName,
    updateSettings,
  };
}
