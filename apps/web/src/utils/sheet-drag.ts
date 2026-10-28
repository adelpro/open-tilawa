/**
 * The physics behind the phone sheet.
 *
 * A bottom sheet is a gesture, not an animation: it has to follow the finger
 * 1:1, decide where it is *going* at release, and hand its velocity to whatever
 * finishes the move. Everything here is pure so the numbers can be tested
 * without a browser (the app's tests run under `node --test`, no DOM).
 */

/** Below this the finger is still "placing" the sheet, not throwing it. */
const DISMISS_VELOCITY = 800;
/** Above this (upward) the release is a deliberate "keep it open", never a dismiss. */
const UPWARD_VELOCITY = -400;
/** Without a flick, the sheet must be dragged past this fraction of its height. */
const DISMISS_FRACTION = 0.4;

/** iOS scroll deceleration; the projection below is calibrated to it. */
const DECELERATION = 0.998;

/**
 * Where a gesture was heading, in pixels — Apple's exponential-decay form, not
 * `v² / 2a`. `current + project(v)` is the resting point to snap to.
 */
export function project(velocity: number, deceleration = DECELERATION): number {
  return ((velocity / 1000) * deceleration) / (1 - deceleration);
}

/**
 * Progressive resistance past a boundary. A hard stop reads as frozen; a soft
 * one reads as "responsive, but there is nothing more here".
 */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/** Pointer travel below this is noise (a tap that wobbled), not a drag. */
export const DRAG_THRESHOLD = 8;

/**
 * The offset to render while the finger is down: downward is 1:1, upward (past
 * the fully-open position) is damped.
 */
export function dragOffset(deltaY: number, height: number): number {
  if (deltaY >= 0) return deltaY;
  return -rubberband(-deltaY, Math.max(1, height));
}

/**
 * Reverse or commit, decided by velocity *and* position — a flick from a few
 * pixels dismisses, a slow long drag dismisses, an upward flick never does.
 */
export function shouldDismiss({
  offset,
  velocity,
  height,
}: {
  offset: number;
  velocity: number;
  height: number;
}): boolean {
  if (velocity <= UPWARD_VELOCITY) return false;
  if (velocity >= DISMISS_VELOCITY) return true;
  return offset + project(Math.max(0, velocity)) > height * DISMISS_FRACTION;
}

export type SpringState = { value: number; velocity: number };

export type SpringOptions = {
  target: number;
  /** Seconds since the previous frame. */
  dt: number;
  /** 1 = critically damped, no overshoot. Lower = bouncier. */
  damping?: number;
  /** How quickly the value reaches the target, in seconds (not a duration). */
  response?: number;
};

/** A frame that arrives late must not fling the value into orbit. */
const MAX_DT = 1 / 30;

/**
 * One frame of a damped spring, semi-implicit Euler.
 *
 * Callers keep the previous `state` and feed it back in: because the step reads
 * the live value *and* velocity, re-targeting mid-flight has no seam — which is
 * the whole reason the sheet is not a CSS transition.
 */
export function springStep(
  state: SpringState,
  { target, dt, damping = 1, response = 0.3 }: SpringOptions,
): SpringState {
  const step = Math.min(Math.max(dt, 0), MAX_DT);
  if (step === 0) return state;

  const omega = (2 * Math.PI) / Math.max(response, 0.05);
  const stiffness = omega * omega;
  const friction = 2 * damping * omega;

  const acceleration = -stiffness * (state.value - target) - friction * state.velocity;
  const velocity = state.velocity + acceleration * step;

  return { value: state.value + velocity * step, velocity };
}
