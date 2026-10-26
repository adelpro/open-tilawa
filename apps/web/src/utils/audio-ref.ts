/**
 * The single <audio> element is owned by the engine, but the scrubber is a
 * grandchild of the shell. Rather than thread a ref through five components,
 * the engine publishes it here.
 */
export const audioRef: { current: HTMLAudioElement | null } = { current: null };
