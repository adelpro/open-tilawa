import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selfUpdateConfig, composeSteps } from '../lib/self-update.mjs';

/**
 * A node updating itself is the one seeder action that runs a process.
 *
 * The tests here pin the two things that would hurt: the feature is off unless
 * asked for, and the command is an argv list — never a string that anything from
 * a request could be appended to.
 */

test('self-update is off unless the deployment asks for it', () => {
  assert.equal(selfUpdateConfig({}).enabled, false);
  assert.equal(selfUpdateConfig({ SEEDER_SELF_UPDATE: '0' }).enabled, false);
  assert.equal(selfUpdateConfig({ SEEDER_SELF_UPDATE: 'true' }).enabled, false);
  assert.equal(selfUpdateConfig({ SEEDER_SELF_UPDATE: '1' }).enabled, true);
});

test('the deployment can name its own compose file, project and service', () => {
  const config = selfUpdateConfig({
    SEEDER_SELF_UPDATE: '1',
    SEEDER_COMPOSE_FILE: '/srv/node/docker-compose.yml',
    SEEDER_COMPOSE_PROJECT: 'tilawa',
    SEEDER_SERVICE: 'seed',
    SEEDER_UPDATE_TIMEOUT_MS: '5000',
  });
  assert.deepEqual(config, {
    enabled: true,
    file: '/srv/node/docker-compose.yml',
    project: 'tilawa',
    service: 'seed',
    timeoutMs: 5000,
  });
});

test('the defaults match the layout the installer writes', () => {
  assert.deepEqual(selfUpdateConfig({}), {
    enabled: false,
    file: '/compose/docker-compose.yml',
    project: 'tilawa-seeder',
    service: 'seeder',
    timeoutMs: 600000,
  });
});

test('a nonsense timeout falls back instead of hanging forever or failing fast', () => {
  for (const value of ['', '0', '-1', 'soon']) {
    assert.equal(selfUpdateConfig({ SEEDER_UPDATE_TIMEOUT_MS: value }).timeoutMs, 600000);
  }
});

test('the update is pull then recreate, and the project is always explicit', () => {
  const steps = composeSteps({
    file: '/compose/docker-compose.yml',
    project: 'tilawa-seeder',
    service: 'seeder',
    timeoutMs: 1000,
  });
  assert.deepEqual(steps, [
    ['compose', '-p', 'tilawa-seeder', '-f', '/compose/docker-compose.yml', 'pull', 'seeder'],
    [
      'compose',
      '-p',
      'tilawa-seeder',
      '-f',
      '/compose/docker-compose.yml',
      'up',
      '-d',
      '--no-deps',
      'seeder',
    ],
  ]);
});

test('no step is a shell string', () => {
  for (const step of composeSteps(selfUpdateConfig({}))) {
    assert.ok(Array.isArray(step));
    assert.ok(step.every((part) => typeof part === 'string' && part.length > 0));
  }
});
