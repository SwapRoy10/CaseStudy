import { describe, expect, it } from 'vitest';
import { WorkStyle } from './types';
import {
  ScoredCandidate,
  filterByAvailability,
  filterByGradeGoal,
  randomTieBreak,
  rankByOverlap,
  tieBreakByWorkStyle,
} from './stages';
import { block, ids, profile } from './testUtils';

function scored(id: string, overlapCount: number, workStyle: WorkStyle = 'GROUP'): ScoredCandidate {
  return { studentId: id, gradeGoal: 'A_TRACK', workStyle, sharedIntervals: [], overlapCount };
}

const me = profile('1', 'A_TRACK', 'GROUP');

describe('stage 1 - filterByGradeGoal', () => {
  it('keeps same grade goal and drops the requester', () => {
    const classmates = [me, profile('2', 'A_TRACK', 'SOLO'), profile('3', 'PASS_TRACK', 'GROUP')];
    expect(ids(filterByGradeGoal(me, classmates))).toEqual(['2']);
  });

  it('pass track only matches pass track', () => {
    const passer = profile('1', 'PASS_TRACK', 'SOLO');
    const classmates = [profile('2', 'A_TRACK', 'SOLO'), profile('3', 'PASS_TRACK', 'GROUP')];
    expect(ids(filterByGradeGoal(passer, classmates))).toEqual(['3']);
  });
});

describe('stage 2 - filterByAvailability', () => {
  it('drops candidates with no shared time and scores the rest', () => {
    const requester = profile('1', 'A_TRACK', 'GROUP', [block(1, 9, 11), block(3, 13, 15)]);
    const candidates = [
      profile('2', 'A_TRACK', 'GROUP', [block(1, 10, 12), block(3, 14, 16)]),
      profile('3', 'A_TRACK', 'GROUP', [block(5, 9, 11)]),
      profile('4', 'A_TRACK', 'GROUP', [block(1, 11, 12)]), // only touches at 11:00
    ];

    const result = filterByAvailability(requester, candidates);
    expect(ids(result)).toEqual(['2']);
    expect(result[0].overlapCount).toBe(2);
    expect(result[0].sharedIntervals).toEqual([block(1, 10, 11), block(3, 14, 15)]);
  });

  it('touching requester blocks count as one block', () => {
    // 9-10 and 10-11 normalize to 9-11 (sdd glossary, canonical availability)
    const requester = profile('1', 'A_TRACK', 'SOLO', [block(1, 9, 10), block(1, 10, 11)]);
    const result = filterByAvailability(requester, [profile('2', 'A_TRACK', 'GROUP', [block(1, 9, 11)])]);
    expect(result[0].overlapCount).toBe(1);
    expect(result[0].sharedIntervals).toEqual([block(1, 9, 11)]);
  });

  it('duplicate requester blocks only count once', () => {
    const requester = profile('1', 'A_TRACK', 'GROUP', [block(1, 9, 11), block(1, 9, 11)]);
    const result = filterByAvailability(requester, [profile('2', 'A_TRACK', 'GROUP', [block(1, 9, 10)])]);
    expect(result[0].overlapCount).toBe(1);
  });

  it("only returns the shared part, not the candidate's whole block", () => {
    const requester = profile('1', 'A_TRACK', 'GROUP', [block(2, 12, 13)]);
    const result = filterByAvailability(requester, [profile('2', 'A_TRACK', 'GROUP', [block(2, 8, 18)])]);
    expect(result[0].sharedIntervals).toEqual([block(2, 12, 13)]);
  });

  it("doesn't change the saved profiles", () => {
    const requester = profile('1', 'A_TRACK', 'GROUP', [block(1, 10, 11), block(1, 9, 10)]);
    const other = profile('2', 'A_TRACK', 'GROUP', [block(1, 9, 11)]);
    const before = JSON.stringify([requester, other]);

    filterByAvailability(requester, [other]);
    expect(JSON.stringify([requester, other])).toBe(before);
  });
});

describe('stage 3 - rankByOverlap', () => {
  it('sorts most overlap first', () => {
    const list = [scored('a', 1), scored('b', 3), scored('c', 2)];
    expect(ids(rankByOverlap(list))).toEqual(['b', 'c', 'a']);
  });

  it("doesn't change the list passed in", () => {
    const list = [scored('a', 1), scored('b', 3)];
    rankByOverlap(list);
    expect(ids(list)).toEqual(['a', 'b']);
  });
});

describe('stage 4 - tieBreakByWorkStyle', () => {
  it('same work style goes first when overlap is tied', () => {
    const list = [scored('a', 2, 'SOLO'), scored('b', 2, 'GROUP'), scored('c', 1, 'GROUP')];
    expect(ids(tieBreakByWorkStyle(me, list))).toEqual(['b', 'a', 'c']);
  });

  it("can't jump someone with more overlap", () => {
    const list = [scored('a', 3, 'SOLO'), scored('b', 1, 'GROUP')];
    expect(ids(tieBreakByWorkStyle(me, list))).toEqual(['a', 'b']);
  });
});

describe('stage 5 - randomTieBreak', () => {
  it('shuffles only within groups tied on both keys', () => {
    const list = [
      scored('a', 2, 'GROUP'),
      scored('b', 2, 'GROUP'),
      scored('c', 2, 'SOLO'),
      scored('d', 1, 'GROUP'),
    ];
    // rng 0 always picks index 0, so [a, b] flips
    expect(ids(randomTieBreak(me, list, () => 0))).toEqual(['b', 'a', 'c', 'd']);
    // 0.99 picks the last index every time, so nothing moves
    expect(ids(randomTieBreak(me, list, () => 0.99))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('leaves untied candidates alone', () => {
    const untied = [scored('a', 3), scored('b', 2), scored('c', 1)];
    expect(ids(randomTieBreak(me, untied, () => 0))).toEqual(['a', 'b', 'c']);
  });
});
