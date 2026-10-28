import { atom } from 'jotai';

import type { StoredSettings } from '@/hooks/use-persistence';

export const gunLoggedInAtom = atom<boolean>(false);
gunLoggedInAtom.debugLabel = 'gun-logged-in';

export const gunUserPubAtom = atom<string | null>(null);
gunUserPubAtom.debugLabel = 'gun-user-pub';

export const gunUserAliasAtom = atom<string | null>(null);
gunUserAliasAtom.debugLabel = 'gun-user-alias';

export const gunLoadingAtom = atom<boolean>(false);
gunLoadingAtom.debugLabel = 'gun-loading';

export const gunErrorAtom = atom<string | null>(null);
gunErrorAtom.debugLabel = 'gun-error';

export const myFavoritesAtom = atom<string[]>([]);
myFavoritesAtom.debugLabel = 'my-favorites';

export const globalViewCountsAtom = atom<Record<string, number>>({});
globalViewCountsAtom.debugLabel = 'global-view-counts';

export const globalFavoriteCountsAtom = atom<Record<string, number>>({});
globalFavoriteCountsAtom.debugLabel = 'global-favorite-counts';

export const userDevicesAtom = atom<Record<string, any>>({});
userDevicesAtom.debugLabel = 'user-devices';

export const userDevicesMetaAtom = atom<Record<string, any>>({});
userDevicesMetaAtom.debugLabel = 'user-devices-meta';

export const userSettingsAtom = atom<StoredSettings>({});
userSettingsAtom.debugLabel = 'user-settings';

/** Last ten reciters this listener opened, newest first. */
export const myRecentAtom = atom<{ id: string; at: number }[]>([]);
myRecentAtom.debugLabel = 'my-recent';
