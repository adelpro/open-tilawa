import assert from 'node:assert/strict';
import test from 'node:test';

import {
  dragOffset,
  project,
  rubberband,
  shouldDismiss,
  springStep,
} from '@/utils/sheet-drag';

/** Apple's projection for deceleration ≈ 0.998 over one second. */
test('project turns a release velocity into the distance it would travel', () => {
  assert.equal(project(0), 0);
  assert.ok(Math.abs(project(1000) - 499) < 1, `expected ~499px, got ${project(1000)}`);
});

test('project is symmetric: an upward flick projects upward', () => {
  assert.ok(project(-1000) < 0);
  assert.equal(project(-1000), -project(1000));
});

test('a fast downward flick dismisses even from a few pixels', () => {
  assert.equal(shouldDismiss({ offset: 20, velocity: 1200, height: 800 }), true);
});

test('a slow short drag settles back', () => {
  assert.equal(shouldDismiss({ offset: 20, velocity: 60, height: 800 }), false);
});

test('a long drag dismisses without any velocity', () => {
  assert.equal(shouldDismiss({ offset: 600, velocity: 0, height: 800 }), true);
});

test('an upward flick keeps the sheet open', () => {
  assert.equal(shouldDismiss({ offset: 120, velocity: -900, height: 800 }), false);
});

test('rubberband resists progressively and never reaches the raw overshoot', () => {
  const small = rubberband(50, 800);
  const large = rubberband(400, 800);
  assert.ok(small < 50 && small > 0);
  assert.ok(large < 400 && large > small);
});

test('dragging up past the top is damped, dragging down tracks 1:1', () => {
  assert.equal(dragOffset(120, 800), 120);
  const up = dragOffset(-80, 800);
  assert.ok(up < 0 && Math.abs(up) < 80);
});

test('a spring carries the release velocity instead of cutting it', () => {
  const withVelocity = springStep(
    { value: 0, velocity: 900 },
    { target: 0, dt: 1 / 60 },
  );
  const fromRest = springStep({ value: 0, velocity: 0 }, { target: 0, dt: 1 / 60 });
  assert.ok(withVelocity.value > fromRest.value, 'velocity must move the first frame');
  assert.ok(withVelocity.velocity < 900, 'and it must decay');
});

test('a critically damped spring never overshoots its target', () => {
  let state = { value: 24, velocity: 0 };
  let max = 0;
  for (let i = 0; i < 240; i += 1) {
    state = springStep(state, { target: 0, dt: 1 / 60 });
    max = Math.max(max, Math.abs(state.value));
  }
  assert.ok(max <= 24 + 1e-6, `overshot to ${max}`);
});

test('a spring settles within a second', () => {
  let state = { value: 760, velocity: 0 };
  for (let i = 0; i < 60; i += 1) {
    state = springStep(state, { target: 0, dt: 1 / 60 });
  }
  assert.ok(Math.abs(state.value) < 2, `still at ${state.value}`);
});

test('an unborn frame cannot explode the spring', () => {
  const state = springStep({ value: 0, velocity: 0 }, { target: 100, dt: 0 });
  assert.equal(state.value, 0);
  const late = springStep({ value: 0, velocity: 0 }, { target: 100, dt: 0.25 });
  assert.ok(Number.isFinite(late.value) && late.value <= 100);
});
