import { describe, expect, it } from '@jest/globals';
import { describeAlert } from '../src/notifications/messages';
import type { AlertEvent } from '../src/notifications/notifications.rules';

const down = (overrides: Partial<AlertEvent> = {}): AlertEvent => ({
  action: 'open',
  kind: 'service.down',
  subject: 'service:1',
  name: 'Tracker',
  title: 'Service down: Tracker',
  detail: '3 consecutive checks failed - last answer: 503 Service Unavailable',
  params: { failures: 3, reason: '503 Service Unavailable' },
  ...overrides,
});

describe('describeAlert', () => {
  it('says what the probe answered, in English', () => {
    expect(describeAlert(down(), 'en').detail).toBe(
      '3 consecutive checks failed. The last answer was: \u2068503 Service Unavailable\u2069.',
    );
  });

  it('says it in Arabic too', () => {
    const { detail } = describeAlert(down(), 'ar');
    expect(detail).toMatch(/[\u0600-\u06FF]/);
    expect(detail).toContain('\u2068503 Service Unavailable\u2069');
  });

  it('keeps the old sentence when there is no reason', () => {
    expect(describeAlert(down({ params: { failures: 3, reason: null } }), 'en').detail).toBe(
      '3 consecutive checks failed.',
    );
  });

  it('does not mention a reason when resolving', () => {
    expect(describeAlert(down({ action: 'resolve' }), 'en').detail).toBe(
      'The service answered the last two checks.',
    );
  });
});
