import { describe, expect, it } from 'vitest';
import { isEligible, rankCandidates } from './pipeline';
import { block, ids, profile } from './testUtils';

// requester is free Mon 9-11, Tue 13-15, Thu 18-20
const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 11), block(2, 13, 15), block(4, 18, 20)]);

describe('rankCandidates', () => {
  it('applies all five rules in order', () => {
    const classmates = [
      me,
      profile('pass', 'PASS_TRACK', 'GROUP', [block(1, 9, 11), block(2, 13, 15), block(4, 18, 20)]),
      profile('noTime', 'A_TRACK', 'GROUP', [block(6, 10, 12)]),
      profile('one', 'A_TRACK', 'GROUP', [block(1, 10, 12)]),
      profile('threeSolo', 'A_TRACK', 'SOLO', [block(1, 9, 10), block(2, 14, 16), block(4, 19, 21)]),
      profile('twoSolo', 'A_TRACK', 'SOLO', [block(1, 9, 11), block(2, 13, 14)]),
      profile('twoGroup', 'A_TRACK', 'GROUP', [block(2, 12, 14), block(4, 17, 19)]),
    ];

    const result = rankCandidates(me, classmates, () => 0);

    // pass is a different grade goal, noTime has no overlap, me is the requester.
    // twoGroup beats twoSolo on work style since both have 2 overlaps.
    expect(ids(result)).toEqual(['threeSolo', 'twoGroup', 'twoSolo', 'one']);
  });

  it('randomly orders candidates that are fully tied', () => {
    const classmates = [
      profile('x', 'A_TRACK', 'GROUP', [block(1, 9, 10)]),
      profile('y', 'A_TRACK', 'GROUP', [block(1, 10, 11)]),
    ];
    expect(ids(rankCandidates(me, classmates, () => 0))).toEqual(['y', 'x']);
    expect(ids(rankCandidates(me, classmates, () => 0.99))).toEqual(['x', 'y']);
  });

  it('shuffle is roughly uniform', () => {
    // 3 fully tied candidates -> 6 possible orders, each should show up about 1/6 of the time
    const classmates = ['x', 'y', 'z'].map((id) => profile(id, 'A_TRACK', 'GROUP', [block(1, 9, 10)]));
    const counts: Record<string, number> = {};

    for (let i = 0; i < 6000; i++) {
      const order = ids(rankCandidates(me, classmates)).join('');
      counts[order] = (counts[order] ?? 0) + 1;
    }

    expect(Object.keys(counts)).toHaveLength(6);
    // expected 1000 each, this range is very loose so it shouldn't randomly fail
    for (const n of Object.values(counts)) {
      expect(n).toBeGreaterThan(850);
      expect(n).toBeLessThan(1150);
    }
  });

  it('returns an empty list when nobody passes the filters', () => {
    const classmates = [profile('pass', 'PASS_TRACK', 'GROUP', [block(1, 9, 11)])];
    expect(rankCandidates(me, classmates)).toEqual([]);
  });
});

describe('isEligible', () => {
  it('true when grade goal matches and there is some overlap', () => {
    expect(isEligible(me, profile('a', 'A_TRACK', 'SOLO', [block(4, 19, 22)]))).toBe(true);
  });

  it('false for a different grade goal', () => {
    expect(isEligible(me, profile('a', 'PASS_TRACK', 'GROUP', [block(1, 9, 11)]))).toBe(false);
  });

  it('false once their schedule no longer overlaps', () => {
    expect(isEligible(me, profile('a', 'A_TRACK', 'GROUP', [block(1, 11, 12)]))).toBe(false);
  });

  it('false for someone in a different course', () => {
    expect(isEligible(me, profile('a', 'A_TRACK', 'GROUP', [block(1, 9, 11)], '2'))).toBe(false);
  });

  it('false when sending to yourself', () => {
    expect(isEligible(me, me)).toBe(false);
  });
});
