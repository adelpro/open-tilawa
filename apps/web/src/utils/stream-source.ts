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

/**
 * What is feeding the stream *now*.
 *
 * The web seed is never removed once added, so "webseed" alone stopped being the
 * truth the moment a peer connected: both sources run concurrently. Stated once
 * here so the footer's glyph and the telemetry counter cannot tell different
 * stories about the same stream.
 */
export function streamSourceFor(state: {
  webSeed?: 'active' | 'off';
  peers?: number;
}): StreamSource {
  const peers = state.peers ?? 0;
  if (state.webSeed === 'active') return peers > 0 ? 'mixed' : 'webseed';
  return peers > 0 ? 'connected' : 'waiting';
}

/**
 * The same state, said in the two words telemetry accepts.
 *
 * `waiting` and `connected` are a torrent; `webseed` and `mixed` mean the HTTP
 * copy our own node serves fed the sound, which is the fallback the counter asks
 * about.
 */
export function telemetrySource(source: StreamSource): 'torrent' | 'webseed' {
  return source === 'webseed' || source === 'mixed' ? 'webseed' : 'torrent';
}
