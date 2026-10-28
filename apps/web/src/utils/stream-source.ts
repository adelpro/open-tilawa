import type { IconName } from '@/components/icons';

/** Where the sound is coming from right now. */
export type StreamSource = 'connected' | 'waiting' | 'webseed' | 'mixed';

/**
 * One glyph per state, for every surface that shows the stream source.
 *
 * `waiting` is the only animated one: no peer is answering yet, so the glyph
 * repeats the search instead of sitting still (see `.wifi-arc` in globals.css).
 * A web seed is our own `/media` origin, so it reads as a server, not a link.
 */
export function iconForSource(source: StreamSource): IconName {
  if (source === 'waiting') return 'wifi-waiting';
  if (source === 'connected') return 'wifi';
  return 'server';
}
