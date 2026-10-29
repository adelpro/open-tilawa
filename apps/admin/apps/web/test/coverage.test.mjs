import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { missingPerNode, totalMissing } from '../src/lib/coverage.ts';

/**
 * The fleet page has to answer "is there anything to push?" before the operator
 * clicks a button. The answer comes from the cached node_torrents table, not from
 * the nodes, so the rule lives in one pure function that can be wrong here first.
 */
const reciter = (infohash, published, heldBy) => ({ infohash, published, heldBy });

describe('missingPerNode', () => {
  it('counts only the published rows a node does not report holding', () => {
    const rows = missingPerNode(
      [reciter('a', true, [{ seederId: 1 }]), reciter('b', true, []), reciter('c', true, [])],
      [1],
    );
    assert.deepEqual(rows, [{ seederId: 1, missing: 2 }]);
  });

  it('ignores unpublished rows: a push never sends them', () => {
    const rows = missingPerNode(
      [reciter('a', false, []), reciter('b', true, [{ seederId: 1 }])],
      [1],
    );
    assert.deepEqual(rows, [{ seederId: 1, missing: 0 }]);
  });

  it('does not count another node as holding it', () => {
    const rows = missingPerNode([reciter('a', true, [{ seederId: 2 }])], [1, 2]);
    assert.deepEqual(rows, [
      { seederId: 1, missing: 1 },
      { seederId: 2, missing: 0 },
    ]);
  });

  it('reports every node complete when the catalogue is empty', () => {
    assert.deepEqual(missingPerNode([], [1, 2]), [
      { seederId: 1, missing: 0 },
      { seederId: 2, missing: 0 },
    ]);
  });
});

describe('totalMissing', () => {
  it('sums across the fleet', () => {
    assert.equal(
      totalMissing([
        { seederId: 1, missing: 3 },
        { seederId: 2, missing: 0 },
      ]),
      3,
    );
  });
});
