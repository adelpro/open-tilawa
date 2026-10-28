import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyCameraError, hasCameraApi } from '@/utils/camera';

/**
 * The decoder rejects with strings, not Errors: `html5-qrcode` wraps every
 * getUserMedia failure as "Error getting userMedia, error = <name>: <message>",
 * so `e.name` is undefined and the cause has to be read out of the text.
 */
const wrapped = (name: string, message: string) =>
  `Error getting userMedia, error = ${name}: ${message}`;

test('a denied permission is reported as blocked, not as a missing camera', () => {
  assert.equal(
    classifyCameraError(wrapped('NotAllowedError', 'Permission denied')),
    'blocked',
  );
});

test('a DOMException keeps its own name', () => {
  assert.equal(
    classifyCameraError(new DOMException('Permission denied', 'NotAllowedError')),
    'blocked',
  );
});

test('no matching device is reported as a missing camera', () => {
  assert.equal(
    classifyCameraError(wrapped('NotFoundError', 'Requested device not found')),
    'no-device',
  );
});

test('constraints that no device satisfies mean there is no camera to use', () => {
  assert.equal(classifyCameraError(new DOMException('x', 'OverconstrainedError')), 'no-device');
});

test('a camera another app owns is busy, not blocked', () => {
  assert.equal(
    classifyCameraError(wrapped('NotReadableError', 'Could not start video source')),
    'busy',
  );
});

test('a browser without mediaDevices cannot scan over http', () => {
  assert.equal(classifyCameraError('navigator.mediaDevices not supported'), 'secure');
  assert.equal(
    classifyCameraError('Camera access is only supported in secure context like https or localhost.'),
    'secure',
  );
});

test('anything unrecognised is unknown, never a wrong diagnosis', () => {
  assert.equal(classifyCameraError(new Error('boom')), 'unknown');
  assert.equal(classifyCameraError(undefined), 'unknown');
  assert.equal(classifyCameraError({}), 'unknown');
});

test('hasCameraApi is false when the API is absent, so scanning is never attempted', () => {
  assert.equal(hasCameraApi(undefined), false);
  assert.equal(hasCameraApi(null), false);
  assert.equal(hasCameraApi({}), false);
  assert.equal(hasCameraApi({ getUserMedia: () => undefined }), true);
});
