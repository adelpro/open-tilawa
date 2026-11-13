/**
 * The console's papers.
 *
 * Same seven stocks as the player, mapped onto the console's own token set: the
 * paper paints the surfaces, and the accent follows the stock (blue on the three
 * neutrals, the paper's own hue on the four coloured ones). Status colours are
 * not in this list on purpose — a warning is the same amber on every paper.
 *
 * Device-local, like the console's zoom: the mode is an account preference, the
 * paper is how this screen is printed.
 */
import type { MessageKey } from './i18n';

export type PaletteId =
  | 'white'
  | 'light-ivory'
  | 'ivory'
  | 'sage'
  | 'slate'
  | 'clay'
  | 'rose';

export type PaletteSwatch = { paper: string; accent: string };

export type PaletteEntry = {
  id: PaletteId;
  /** A `prefs.palette.*` message key. */
  label: MessageKey;
  light: PaletteSwatch;
  dark: PaletteSwatch;
};

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 'white',
    label: 'prefs.palette.white',
    light: { paper: '#ffffff', accent: '#086288' },
    dark: { paper: '#2c2c2e', accent: '#97d7ff' },
  },
  {
    id: 'light-ivory',
    label: 'prefs.palette.lightIvory',
    light: { paper: '#fdfbf6', accent: '#086288' },
    dark: { paper: '#201e1a', accent: '#97d7ff' },
  },
  {
    id: 'ivory',
    label: 'prefs.palette.ivory',
    light: { paper: '#faf6ee', accent: '#086288' },
    dark: { paper: '#201c18', accent: '#97d7ff' },
  },
  {
    id: 'sage',
    label: 'prefs.palette.sage',
    light: { paper: '#f6f7f2', accent: '#23603f' },
    dark: { paper: '#1a1e1a', accent: '#a8d8c2' },
  },
  {
    id: 'slate',
    label: 'prefs.palette.slate',
    light: { paper: '#f7f9fb', accent: '#14506f' },
    dark: { paper: '#171c22', accent: '#a9cbe8' },
  },
  {
    id: 'clay',
    label: 'prefs.palette.clay',
    light: { paper: '#fdf7f2', accent: '#8a4526' },
    dark: { paper: '#221a15', accent: '#e8b898' },
  },
  {
    id: 'rose',
    label: 'prefs.palette.rose',
    light: { paper: '#fdf7f7', accent: '#7d3352' },
    dark: { paper: '#221419', accent: '#e3b3c6' },
  },
];

export function isPalette(value: unknown): value is PaletteId {
  return PALETTES.some((entry) => entry.id === value);
}
