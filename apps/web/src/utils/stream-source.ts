import type { IconName } from '@/components/icons';

/** Where the sound is coming from right now. */
export type StreamSource = 'connected' | 'waiting' | 'webseed' | 'mixed' | 'direct';

/**
 * Why the element is playing the node's own copy instead of the stream.
 *
 * Two situations, and only one of them is a fault:
 * `nostream` is a browser that never had a service worker (Facebook and
 * Instagram in-app browsers on iOS) — it opens the direct file from the first
 * second and nothing broke. `afterDrop` is the stream that failed mid-play and
 * had to be re-pointed.
 */
export type DirectReason = 'none' | 'nostream' | 'afterDrop';

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
  direct?: DirectReason;
}): StreamSource {
  // The rescue outranks the torrent: no peer is feeding a re-pointed element.
  if (state.direct === 'afterDrop') return 'direct';
  // No streaming server at all is not a break — the node's copy simply is the
  // source, which is what `webseed` already says.
  if (state.direct === 'nostream') return 'webseed';
  const peers = state.peers ?? 0;
  if (state.webSeed === 'active') return peers > 0 ? 'mixed' : 'webseed';
  return peers > 0 ? 'connected' : 'waiting';
}
