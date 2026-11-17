import type { DeviceState } from './device';
import type { HeldReciter } from './catalogue';
import type { HeldState } from './state';
import type { Settings } from './settings';

/**
 * Two wires, and they must not be confused.
 *
 * `EngineRequest` travels **background → host** (offscreen document on Chrome,
 * the background itself on Firefox). `UiRequest` travels **UI → background**,
 * and only the background answers it: it owns the clock, the gate and the
 * counters, so a page that closed cannot leave a seeder running without one.
 */
export type EngineRequest =
  | { type: 'engine:start'; settings?: Settings; held?: HeldReciter[] }
  | { type: 'engine:add'; reciter: HeldReciter }
  | { type: 'engine:remove'; infohash: string }
  | { type: 'engine:snapshot' }
  | { type: 'engine:pause' }
  | { type: 'engine:resume' }
  | { type: 'engine:upload'; mbps: number }
  | { type: 'state:device' };

export type EngineReply = {
  ok: boolean;
  states?: HeldState[];
  device?: DeviceState;
  error?: string;
};

export type UiRequest =
  | { type: 'state:snapshot' }
  | { type: 'state:start' }
  | { type: 'state:pause' }
  | { type: 'state:resume' }
  | { type: 'state:remove'; infohash: string }
  | { type: 'state:counters' }
  | { type: 'state:tick' };

export type Counters = { today: number; total: number };

export type UiReply = {
  ok: boolean;
  states?: HeldState[];
  counters?: Counters;
  /** Catalogue notices the person has not seen yet (D13). */
  pending?: number;
  error?: string;
};

/**
 * What the host answers: the engine's own verbs, plus the one device question.
 *
 * `state:device` is the exception that earns its place. The background needs the
 * battery and the connection to apply the pauses, and a worker cannot read
 * either — only the page that hosts the engine can. Every other `state:*`
 * message belongs to the background, and a wrong answer here is a pause that
 * silently never happens.
 */
export const isEngineRequest = (value: unknown): value is EngineRequest => {
  if (!value || typeof value !== 'object') return false;
  const type = (value as { type?: unknown }).type;
  if (typeof type !== 'string') return false;
  return type.startsWith('engine:') || type === 'state:device';
};
