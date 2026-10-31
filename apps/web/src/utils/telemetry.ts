export type PlayTelemetryEvent = {
  event: 'play' | 'complete' | 'error' | 'fallback';
  reciter: string;
  surah: number;
  source: 'torrent' | 'webseed';
  errorCode?: string;
  msToPlay?: '0-1s' | '1-3s' | '3-10s' | '10s+';
  version: string;
  locale: 'ar' | 'en';
};

/**
 * One per consenting device per day, and nothing else.
 *
 * It exists because "how many devices listen" cannot be answered by a play count:
 * one listener plays thirty surahs. The answer costs no identifier — the day is
 * the whole payload, so the server counts rows and cannot join two days.
 */
export type DeviceTelemetryEvent = {
  event: 'device';
  version: string;
  locale: 'ar' | 'en';
};

/**
 * The first play of the day, on a consenting device.
 *
 * A `play` event cannot answer "how many devices ever started listening": one
 * listener plays thirty surahs. This one is sent once per device per day, before
 * the play it announces, and carries no reciter — so the server can count
 * listeners without being able to join two days of them.
 */
export type FirstPlayTelemetryEvent = {
  event: 'first_play';
  version: string;
  locale: 'ar' | 'en';
};

export type TelemetryEvent = PlayTelemetryEvent | DeviceTelemetryEvent | FirstPlayTelemetryEvent;

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
export function msToPlayBucket(ms: number): PlayTelemetryEvent['msToPlay'] {
  if (!Number.isFinite(ms) || ms < 0) return '10s+';
  if (ms < 1000) return '0-1s';
  if (ms < 3000) return '1-3s';
  if (ms < 10_000) return '3-10s';
  return '10s+';
}

/**
 * The event the player builds when sound actually starts.
 *
 * `msToPlay` is the raw wait and leaves here as a band; omitted when no clock was
 * taken, because "unknown" must not become "slowest".
 */
export function playEvent(input: {
  reciter: string;
  surah: number;
  source: PlayTelemetryEvent['source'];
  version: string;
  locale: PlayTelemetryEvent['locale'];
  msToPlay?: number;
}): PlayTelemetryEvent {
  const event: PlayTelemetryEvent = {
    event: 'play',
    reciter: input.reciter,
    surah: input.surah,
    source: input.source,
    version: input.version,
    locale: input.locale,
  };
  if (typeof input.msToPlay === 'number') event.msToPlay = msToPlayBucket(input.msToPlay);
  return event;
}

/** A code, never a message: the browser's text can carry a URL or a device name. */
export function mediaErrorCode(code?: number | null): string {
  switch (code) {
    case 1:
      return 'MEDIA_ERR_ABORTED';
    case 2:
      return 'MEDIA_ERR_NETWORK';
    case 3:
      return 'MEDIA_ERR_DECODE';
    case 4:
      return 'MEDIA_ERR_SRC_NOT_SUPPORTED';
    default:
      return 'unknown';
  }
}

export function errorEvent(input: {
  reciter: string;
  surah: number;
  source: PlayTelemetryEvent['source'];
  version: string;
  locale: PlayTelemetryEvent['locale'];
  code?: number | null;
}): PlayTelemetryEvent {
  return {
    event: 'error',
    reciter: input.reciter,
    surah: input.surah,
    source: input.source,
    errorCode: mediaErrorCode(input.code),
    version: input.version,
    locale: input.locale,
  };
}

/** The daily "a device was here" event; its whole payload is the day it is sent. */
export function deviceEvent(input: {
  version: string;
  locale: DeviceTelemetryEvent['locale'];
}): DeviceTelemetryEvent {
  return { event: 'device', version: input.version, locale: input.locale };
}

/** The daily "this device started listening" event; same shape, different verb. */
export function firstPlayEvent(input: {
  version: string;
  locale: FirstPlayTelemetryEvent['locale'];
}): FirstPlayTelemetryEvent {
  return { event: 'first_play', version: input.version, locale: input.locale };
}
