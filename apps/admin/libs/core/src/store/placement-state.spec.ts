import {
  deriveReciterState,
  isExpired,
  nextPlacementState,
  PENDING_TTL_HOURS,
} from './placement-state';

describe('deriveReciterState', () => {
  it('calls a published reciter held by a node healthy', () => {
    expect(deriveReciterState({ published: true, heldByNodes: 1, placements: ['placed'] })).toBe(
      'healthy',
    );
  });

  it('calls a published reciter held nowhere unseeded — the one urgent state', () => {
    expect(deriveReciterState({ published: true, heldByNodes: 0, placements: [] })).toBe('unseeded');
  });

  it('does not let a pending request count as held', () => {
    // We asked; the node has not confirmed. The site still cannot play it.
    expect(
      deriveReciterState({ published: true, heldByNodes: 0, placements: ['pending'] }),
    ).toBe('unseeded');
  });

  it('calls a draft held by a node stale, and a draft held nowhere dormant', () => {
    expect(deriveReciterState({ published: false, heldByNodes: 1, placements: ['placed'] })).toBe(
      'stale',
    );
    expect(deriveReciterState({ published: false, heldByNodes: 0, placements: [] })).toBe('dormant');
  });
});

describe('isExpired', () => {
  const now = new Date('2026-10-28T12:00:00Z');

  it('expires a pending placement older than the TTL', () => {
    expect(isExpired('2026-10-28T08:00:00Z', now)).toBe(true);
    expect(isExpired('2026-10-28T10:00:00Z', now)).toBe(false);
  });

  it('treats an unparseable timestamp as not expired', () => {
    expect(isExpired('not a date', now)).toBe(false);
  });

  it('uses three hours', () => {
    expect(PENDING_TTL_HOURS).toBe(3);
  });
});

describe('nextPlacementState', () => {
  it('confirms a pending placement the node reports', () => {
    expect(nextPlacementState({ current: 'pending', observed: true, expired: false })).toEqual({
      state: 'placed',
      error: null,
    });
  });

  it('keeps waiting until the TTL runs out', () => {
    expect(nextPlacementState({ current: 'pending', observed: false, expired: false })).toEqual({
      state: 'pending',
      error: null,
    });
    expect(nextPlacementState({ current: 'pending', observed: false, expired: true })).toEqual({
      state: 'failed',
      error: `not confirmed within ${PENDING_TTL_HOURS} hours`,
    });
  });

  it('fails a placed torrent the node no longer reports', () => {
    expect(nextPlacementState({ current: 'placed', observed: false, expired: false })).toEqual({
      state: 'failed',
      error: 'no longer on the node',
    });
  });

  it('leaves a failure alone while it stays unobserved', () => {
    expect(nextPlacementState({ current: 'failed', observed: false, expired: true })).toEqual({
      state: 'failed',
      error: null,
    });
  });
});
