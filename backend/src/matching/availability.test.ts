import { describe, expect, it } from 'vitest';
import { intersect, mergeIntervals, normalizeBlocks, sharedIntersections } from './availability';
import { block } from './testUtils';

describe('intersect', () => {
  it('returns the clipped overlap', () => {
    expect(intersect(block(1, 9, 11), block(1, 10, 12))).toEqual(block(1, 10, 11));
  });

  it('returns null for different weekdays', () => {
    expect(intersect(block(1, 9, 11), block(2, 9, 11))).toBeNull();
  });

  it('touching endpoints are not an overlap', () => {
    expect(intersect(block(1, 9, 10), block(1, 10, 11))).toBeNull();
  });
});

describe('normalizeBlocks', () => {
  it('merges touching and overlapping blocks on the same day', () => {
    expect(normalizeBlocks([block(1, 10, 11), block(1, 9, 10), block(1, 10.5, 12)])).toEqual([
      block(1, 9, 12),
    ]);
  });

  it('removes duplicates', () => {
    expect(normalizeBlocks([block(2, 9, 10), block(2, 9, 10)])).toEqual([block(2, 9, 10)]);
  });

  it('keeps separate days and gaps apart', () => {
    const blocks = [block(1, 9, 10), block(1, 11, 12), block(2, 9, 10)];
    expect(normalizeBlocks(blocks)).toEqual(blocks);
  });

  it("doesn't modify the input", () => {
    const blocks = [block(1, 10, 11), block(1, 9, 10)];
    normalizeBlocks(blocks);
    expect(blocks).toEqual([block(1, 10, 11), block(1, 9, 10)]);
  });
});

describe('mergeIntervals (display)', () => {
  it('merges overlapping intervals', () => {
    expect(mergeIntervals([block(1, 10, 12), block(1, 9, 11)])).toEqual([block(1, 9, 12)]);
  });

  it('keeps touching intervals separate', () => {
    expect(mergeIntervals([block(1, 9, 10), block(1, 10, 11)])).toEqual([
      block(1, 9, 10),
      block(1, 10, 11),
    ]);
  });
});

describe('sharedIntersections', () => {
  it('counts a requester block that hits two candidate blocks once', () => {
    const result = sharedIntersections([block(1, 9, 13)], [block(1, 9, 10), block(1, 12, 14)]);
    expect(result.overlapCount).toBe(1);
    expect(result.intervals).toEqual([block(1, 9, 10), block(1, 12, 13)]);
  });

  it('handles several blocks on one day', () => {
    const result = sharedIntersections([block(1, 9, 10), block(1, 14, 16)], [block(1, 8, 17)]);
    expect(result.overlapCount).toBe(2);
    expect(result.intervals).toEqual([block(1, 9, 10), block(1, 14, 16)]);
  });

  it('overlapping candidate blocks merge for display without changing the count', () => {
    const result = sharedIntersections([block(1, 9, 12)], [block(1, 9, 11), block(1, 10, 12)]);
    expect(result.overlapCount).toBe(1);
    expect(result.intervals).toEqual([block(1, 9, 12)]);
  });

  it('nothing shared on different days', () => {
    const result = sharedIntersections([block(1, 9, 10)], [block(2, 9, 10)]);
    expect(result).toEqual({ intervals: [], overlapCount: 0 });
  });
});
