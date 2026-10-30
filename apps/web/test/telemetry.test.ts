import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createTelemetry, msToPlayBucket, type TelemetryEvent } from '../src/utils/telemetry.ts';

const event = (over: Partial<TelemetryEvent> = {}): TelemetryEvent => ({
  event: 'play',
  reciter: 'maher-al-muaiqly',
  surah: 18,
  source: 'torrent',
  version: '1.10.7',
  locale: 'ar',
  ...over,
});

test('nothing is queued, and nothing is sent, while the switch is off', async () => {
  const sent: TelemetryEvent[][] = [];
  const telemetry = createTelemetry({ enabled: () => false, send: async (batch) => void sent.push(batch) });

  telemetry.record(event());
  await telemetry.flush();

  assert.equal(telemetry.size(), 0);
  assert.deepEqual(sent, []);
});

test('events collected while on go out as one batch', async () => {
  const sent: TelemetryEvent[][] = [];
  const telemetry = createTelemetry({ enabled: () => true, send: async (batch) => void sent.push(batch) });

  telemetry.record(event());
  telemetry.record(event({ event: 'complete' }));
  telemetry.record(event({ surah: 19 }));
  await telemetry.flush();

  assert.equal(sent.length, 1);
  assert.equal(sent[0].length, 3);
});

test('turning the switch off drops what was already queued', async () => {
  let enabled = true;
  const sent: TelemetryEvent[][] = [];
  const telemetry = createTelemetry({ enabled: () => enabled, send: async (batch) => void sent.push(batch) });

  telemetry.record(event());
  enabled = false;
  telemetry.stop();
  await telemetry.flush();

  assert.equal(telemetry.size(), 0);
  assert.deepEqual(sent, [], 'a queued event was sent after the switch went off');
});

test('the payload carries no identifier', async () => {
  const sent: TelemetryEvent[][] = [];
  const telemetry = createTelemetry({ enabled: () => true, send: async (batch) => void sent.push(batch) });

  telemetry.record(event());
  await telemetry.flush();

  assert.deepEqual(Object.keys(sent[0][0]).sort(), [
    'event',
    'locale',
    'reciter',
    'source',
    'surah',
    'version',
  ]);
});

test('start time is reported as a band, never a number', () => {
  assert.equal(msToPlayBucket(400), '0-1s');
  assert.equal(msToPlayBucket(2500), '1-3s');
  assert.equal(msToPlayBucket(8000), '3-10s');
  assert.equal(msToPlayBucket(42_000), '10s+');
  assert.equal(msToPlayBucket(Number.NaN), '10s+');
});
