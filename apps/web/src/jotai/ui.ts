import { atom } from 'jotai';

import { loadState } from '@/hooks/use-persistence';

/** Reactive mirror of the stored theme, so the toggle can re-label itself. */
export const themeAtom = atom<'dark' | 'light'>(loadState().theme === 'light' ? 'light' : 'dark');
