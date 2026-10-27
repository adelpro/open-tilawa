import { atom } from 'jotai';

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

export const myFavMetaAtom = atom<Record<string, { favorited: boolean; updatedAt: number }>>({});
myFavMetaAtom.debugLabel = 'my-fav-meta';

export const globalViewCountsAtom = atom<Record<string, number>>({});
globalViewCountsAtom.debugLabel = 'global-view-counts';

export const globalFavoriteCountsAtom = atom<Record<string, number>>({});
globalFavoriteCountsAtom.debugLabel = 'global-favorite-counts';

export const userDevicesAtom = atom<Record<string, any>>({});
userDevicesAtom.debugLabel = 'user-devices';

export const userDevicesMetaAtom = atom<Record<string, any>>({});
userDevicesMetaAtom.debugLabel = 'user-devices-meta';

export const userCurrentReciterAtom = atom<number | null>(null);
userCurrentReciterAtom.debugLabel = 'user-current-reciter';

export const userCurrentSurahAtom = atom<number | null>(null);
userCurrentSurahAtom.debugLabel = 'user-current-surah';

export const userProgressAtom = atom<{ surahId?: number; position?: number; updatedAt?: number } | null>(null);
userProgressAtom.debugLabel = 'user-progress';

export const userProfileAtom = atom<{ displayName?: string; avatarUrl?: string } | null>(null);
userProfileAtom.debugLabel = 'user-profile';

/** Last ten reciters this listener opened, newest first. */
export const myRecentAtom = atom<{ id: string; at: number }[]>([]);
myRecentAtom.debugLabel = 'my-recent';
