/**
 * The paper list.
 *
 * A palette here is a *paper*, not a skin: it may move surfaces, ink and the
 * one spectrum hue, and nothing else. The player has no accent to recolour, so
 * `default` is the white page and every other entry is another stock off the
 * same press — the layout, the type scale and the playback semantics do not
 * know which one is chosen.
 *
 * `:root` in `app/globals.css` *is* `default`. The other entries are additive
 * blocks further down the same file, and the swatch below repeats their two
 * colours because the picker has to paint a paper before it is chosen.
 * `test/palettes.test.ts` fails when the CSS and the swatch drift apart.
 */
export type PaletteId = 'default' | 'paper';

export type PaletteSwatch = { bg: string; wave: string };

export type PaletteEntry = {
  id: PaletteId;
  /** A `settings` message key: the chip's name. */
  label: 'paperWhite' | 'paperIvory';
  /** What the chip paints in the current mode: the page, and the spectrum. */
  light: PaletteSwatch;
  dark: PaletteSwatch;
};

export const PALETTES: readonly PaletteEntry[] = [
  {
    id: 'default',
    label: 'paperWhite',
    light: { bg: '#ffffff', wave: '#1c4d78' },
    dark: { bg: '#0b0b0c', wave: '#a6c9ec' },
  },
  {
    id: 'paper',
    label: 'paperIvory',
    light: { bg: '#f7f2e8', wave: '#1e4a6f' },
    dark: { bg: '#151310', wave: '#a9c8e6' },
  },
];

export function isPalette(value: unknown): value is PaletteId {
  return PALETTES.some((entry) => entry.id === value);
}
