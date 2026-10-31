import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selfUpdateConfig, composeSteps } from '../lib/self-update.mjs';

/**
 * A node updating itself is the one seeder action that runs a process.
 *
 * The tests here pin the three things that would hurt: the feature is off unless
 * asked for, the command is an argv list (never a string anything from a request
 * could be appended to), and the recreate happens in a detached helper — a
 * container cannot stop itself and finish the job.
 */

test('self-update is off unless the deployment asks for it', () => {
  assert.equal(selfUpdateConfig({}).enabled, false);
  assert.equal(selfUpdateConfig({ SEEDER_SELF_UPDATE: '0' }).enabled, false);
  assert.equal(selfUpdateConfig({ SEEDER_SELF_UPDATE: 'true' }).enabled, false);
  assert.equal(selfUpdateConfig({ SEEDER_SELF_UPDATE: '1' }).enabled, true);
});

test('the deployment can name its own compose file, project, service and helper', () => {
  const config = selfUpdateConfig({
    SEEDER_SELF_UPDATE: '1',
    SEEDER_COMPOSE_FILE: '/compose/stack.yml',
    SEEDER_COMPOSE_HOST_FILE: '/srv/node/stack.yml',
    SEEDER_COMPOSE_PROJECT: 'tilawa',
    SEEDER_SERVICE: 'seed',
    SEEDER_HELPER_IMAGE: 'docker:28-cli',
    SEEDER_UPDATE_TIMEOUT_MS: '5000',
  });
  assert.deepEqual(config, {
    enabled: true,
    file: '/compose/stack.yml',
    hostFile: '/srv/node/stack.yml',
    project: 'tilawa',
    service: 'seed',
    helperImage: 'docker:28-cli',
    timeoutMs: 5000,
  });
});

test('the defaults match the layout the installer writes', () => {
  assert.deepEqual(selfUpdateConfig({}), {
    enabled: false,
    file: '/compose/docker-compose.yml',
    hostFile: '/opt/tilawa-seeder/docker-compose.yml',
    project: 'tilawa-seeder',
    service: 'seeder',
    helperImage: 'docker:27-cli',
    timeoutMs: 600000,
  });
});

test('a nonsense timeout falls back instead of hanging forever or failing fast', () => {
  for (const value of ['', '0', '-1', 'soon']) {
    assert.equal(selfUpdateConfig({ SEEDER_UPDATE_TIMEOUT_MS: value }).timeoutMs, 600000);
  }
});

test('pull runs in the foreground, the recreate runs detached', () => {
  const [pull, up] = composeSteps({
    file: '/compose/docker-compose.yml',
    hostFile: '/opt/tilawa-seeder/docker-compose.yml',
    project: 'tilawa-seeder',
    service: 'seeder',
    helperImage: 'docker:27-cli',
    timeoutMs: 1000,
  });

  // Foreground: its exit code is the one the console can still report.
  assert.equal(pull.includes('-d'), false);
  assert.deepEqual(pull.slice(-7), [
    'compose',
    '-p',
    'tilawa-seeder',
    '-f',
    '/compose/docker-compose.yml',
    'pull',
    'seeder',
  ]);
  assert.ok(pull.includes('docker:27-cli'));
  assert.ok(pull.includes('/var/run/docker.sock:/var/run/docker.sock'));
  assert.ok(pull.includes('/opt/tilawa-seeder/docker-compose.yml:/compose/docker-compose.yml:ro'));

  // Detached: the helper is owned by the daemon, so it survives the container it
  // is about to replace.
  assert.equal(up.includes('-d'), true);
  assert.deepEqual(up.slice(-9), [
    'compose',
    '-p',
    'tilawa-seeder',
    '-f',
    '/compose/docker-compose.yml',
    'up',
    '-d',
    '--no-deps',
    'seeder',
  ]);
});

test('the helper never runs a shell', () => {
  const config = selfUpdateConfig({ SEEDER_SELF_UPDATE: '1' });
  for (const step of composeSteps(config)) {
    assert.ok(step.every((part) => typeof part === 'string' && part.length > 0));
    assert.equal(step.includes('-c'), false);
    assert.equal(step.includes('sh'), false);
  }
});
