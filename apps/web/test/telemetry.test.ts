import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  createTelemetry,
  deviceEvent,
  errorEvent,
  firstPlayEvent,
  msToPlayBucket,
  playEvent,
  type TelemetryEvent,
} from '../src/utils/telemetry.ts';

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

test('a play event names the surah, the source and the band it started in', () => {
  const built = playEvent({
    reciter: 'maher-al-muaiqly',
    surah: 18,
    source: 'webseed',
    version: '1.10.7',
    locale: 'ar',
    msToPlay: 2500,
  });

  assert.deepEqual(built, {
    event: 'play',
    reciter: 'maher-al-muaiqly',
    surah: 18,
    source: 'webseed',
    version: '1.10.7',
    locale: 'ar',
    msToPlay: '1-3s',
  });
});

test('a play event with no clock leaves the band out instead of inventing one', () => {
  const built = playEvent({
    reciter: 'maher-al-muaiqly',
    surah: 18,
    source: 'torrent',
    version: '1.10.7',
    locale: 'en',
  });

  assert.equal('msToPlay' in built, false);
});

test('an error event carries the media error by name, never the code number', () => {
  const base = {
    reciter: 'maher-al-muaiqly',
    surah: 2,
    source: 'torrent' as const,
    version: '1.10.7',
    locale: 'ar' as const,
  };

  assert.equal(errorEvent({ ...base, code: 4 }).errorCode, 'MEDIA_ERR_SRC_NOT_SUPPORTED');
  assert.equal(errorEvent({ ...base, code: 2 }).errorCode, 'MEDIA_ERR_NETWORK');
  assert.equal(errorEvent({ ...base }).errorCode, 'unknown');
  assert.equal(errorEvent({ ...base, code: 2 }).event, 'error');
});

test('a device event carries the day\'s verb and nothing that could identify it', () => {
  const event = deviceEvent({ version: '1.12.2', locale: 'ar' });
  assert.deepEqual(event, { event: 'device', version: '1.12.2', locale: 'ar' });
  assert.deepEqual(Object.keys(event).sort(), ['event', 'locale', 'version']);
});

test('the first play of the day says only that it played, and which build', () => {
  const event = firstPlayEvent({ version: '1.12.2', locale: 'en' });
  assert.deepEqual(event, { event: 'first_play', version: '1.12.2', locale: 'en' });
  // Not a play event wearing another verb: no reciter, no surah, nothing to join.
  assert.deepEqual(Object.keys(event).sort(), ['event', 'locale', 'version']);
});

test('a device event is batched like any other, and dropped when the switch is off', async () => {
  const sent: TelemetryEvent[][] = [];
  const telemetry = createTelemetry({ enabled: () => true, send: async (batch) => void sent.push(batch) });

  telemetry.record(deviceEvent({ version: '1.12.2', locale: 'en' }));
  await telemetry.flush();

  assert.equal(sent.length, 1);
  assert.equal(sent[0][0].event, 'device');
});
