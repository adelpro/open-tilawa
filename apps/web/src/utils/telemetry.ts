export type TelemetryEvent = {
  event: 'play' | 'complete' | 'error' | 'fallback';
  reciter: string;
  surah: number;
  source: 'torrent' | 'webseed';
  errorCode?: string;
  msToPlay?: '0-1s' | '1-3s' | '3-10s' | '10s+';
  version: string;
  locale: 'ar' | 'en';
};

export type TelemetryDeps = {
  enabled: () => boolean;
  send: (batch: TelemetryEvent[]) => Promise<void>;
  now?: () => number;
};

/**
 * The client half of the consent gate.
 *
 * `enabled()` is asked every time, never remembered: the switch can go off between two
 * events, and a queue built while it was on must not flush after it is off. `stop()` is
 * therefore not a courtesy — it is what makes the switch mean something immediately.
 *
 * There is no identifier in the payload, so a batch is just a list of events that cannot be
 * joined to each other. That is the trade this feature made, and it is why nothing here
 * needs a session.
 */
export function createTelemetry({ enabled, send, now = Date.now }: TelemetryDeps) {
  const interval = 30_000;
  let queue: TelemetryEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = 0;

  const clear = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const flush = async (): Promise<void> => {
    clear();
    if (!enabled()) {
      queue = [];
      return;
    }
    const batch = queue;
    queue = [];
    if (batch.length === 0) return;
    try {
      await send(batch);
    } catch {
      // A failed send is not worth retrying forever: the sample is a sample, and holding
      // it would mean sending after the switch might have been turned off.
    }
  };

  return {
    record(event: TelemetryEvent): void {
      if (!enabled()) return;
      queue.push(event);
      if (queue.length >= 20) void flush();
      else if (timer === null) {
        const wait = Math.max(0, interval - (now() - last));
        timer = setTimeout(() => {
          last = now();
          void flush();
        }, wait);
      }
    },

    flush,

    /** Called when the switch goes off or the page is going away. */
    stop(): void {
      clear();
      queue = [];
    },

    size(): number {
      return queue.length;
    },
  };
}

/** `ms_to_play` is bucketed: the client reports a band, never a precise moment. */
export function msToPlayBucket(ms: number): TelemetryEvent['msToPlay'] {
  if (!Number.isFinite(ms) || ms < 0) return '10s+';
  if (ms < 1000) return '0-1s';
  if (ms < 3000) return '1-3s';
  if (ms < 10_000) return '3-10s';
  return '10s+';
}
