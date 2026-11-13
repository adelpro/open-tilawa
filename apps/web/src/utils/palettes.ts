/**
 * The paper list.
 *
 * A palette here is a *stock and the ink it is printed with*, not a skin. The
 * play button, the selected chip and every filled action are `--ink`, so the
 * ink is the palette's voice: carbon on white, iron-gall on ivory, green-black
 * on sage, blue-black on slate. There is still exactly one colour on the page —
 * tinting the ink is how a paper gets a character without gaining an accent.
 *
 * `:root` in `app/globals.css` *is* `default`. The other stocks are additive
 * blocks further down the same file, and the swatch below repeats two of their
 * values because the picker has to paint a paper — and its primary — before it
 * is chosen. `test/palettes.test.ts` fails when the CSS and the swatch drift.
 */
export type PaletteId = 'default' | 'ivory-white' | 'paper' | 'sage' | 'slate' | 'clay';

export type PaletteSwatch = { paper: string; ink: string };

export type PaletteEntry = {
  id: PaletteId;
  /** A `settings` message key: the chip's name. */
  label:
    | 'paperWhite'
    | 'paperLightIvory'
    | 'paperIvory'
    | 'paperSage'
    | 'paperSlate'
    | 'paperClay';
  /** What the chip paints in the current mode: the page, and the ink on it. */
  light: PaletteSwatch;
  dark: PaletteSwatch;
};

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 'default',
    label: 'paperWhite',
    light: { paper: '#ffffff', ink: '#111111' },
    dark: { paper: '#0b0b0c', ink: '#f2f2f2' },
  },
  {
    id: 'ivory-white',
    label: 'paperLightIvory',
    light: { paper: '#fdfbf7', ink: '#111111' },
    dark: { paper: '#0d0c0b', ink: '#f2f2f2' },
  },
  {
    id: 'paper',
    label: 'paperIvory',
    light: { paper: '#f7f2e8', ink: '#111111' },
    dark: { paper: '#151310', ink: '#f2f2f2' },
  },
  {
    id: 'sage',
    label: 'paperSage',
    light: { paper: '#eef0e6', ink: '#1f2a22' },
    dark: { paper: '#101311', ink: '#e8ede6' },
  },
  {
    id: 'slate',
    label: 'paperSlate',
    light: { paper: '#edf1f5', ink: '#16202b' },
    dark: { paper: '#0d1116', ink: '#e9eef4' },
  },
  {
    id: 'clay',
    label: 'paperClay',
    light: { paper: '#f5e9df', ink: '#2a1c15' },
    dark: { paper: '#17110e', ink: '#f0e6dd' },
  },
];

export function isPalette(value: unknown): value is PaletteId {
  return PALETTES.some((entry) => entry.id === value);
}
