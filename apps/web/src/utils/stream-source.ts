import type { IconName } from '@/components/icons';

/** Where the sound is coming from right now. */
export type StreamSource = 'connected' | 'waiting' | 'webseed' | 'mixed' | 'direct';

/**
 * One glyph per state, for every surface that shows the stream source.
 *
 * `waiting` is the only animated one: no peer is answering yet, so the glyph
 * repeats the search instead of sitting still (see `.wifi-arc` in globals.css).
 * A web seed is our own `/media` origin, so it reads as a server, not a link —
 * and so does `direct`, which is that same origin reached because the stream
 * broke.
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
 *
 * `direct` outranks all of it. It is not a fourth way of listening but a fact
 * about the element: after a failed service-worker stream the player re-points
 * it at the node's own copy, and from that moment no peer is feeding anything —
 * whatever the torrent still reports.
 */
export function streamSourceFor(state: {
  webSeed?: 'active' | 'off';
  peers?: number;
  direct?: boolean;
}): StreamSource {
  if (state.direct) return 'direct';
  const peers = state.peers ?? 0;
  if (state.webSeed === 'active') return peers > 0 ? 'mixed' : 'webseed';
  return peers > 0 ? 'connected' : 'waiting';
}
