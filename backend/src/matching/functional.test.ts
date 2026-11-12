import { describe, expect, it, vi } from 'vitest';
import { isEligible, rankCandidates } from './pipeline';
import { findCandidates } from './findCandidates';
import { getAverages, getCourseProfiles } from './data';
import * as mock from './mockData';
import { block, ids, profile } from './testUtils';
import { Profile } from './types';

// matching test cases from the functional testing doc (section 5.5) that weren't
// covered anywhere else yet. the comment above each test says which case it is,
// so it's easy to check them off. times are in hours, so 9.5 means 9:30

vi.mock('./data', async () => {
  const real = await import('./mockData.js');
  return {
    ...real,
    getCourseProfiles: vi.fn(real.getCourseProfiles),
    getAverages: vi.fn(real.getAverages),
  };
});

// runs matching n times and counts how often each order shows up
function countOrders(me: Profile, classmates: Profile[], runs: number) {
  const counts = new Map<string, number>();
  for (let i = 0; i < runs; i++) {
    const order = ids(rankCandidates(me, classmates)).join(',');
    counts.set(order, (counts.get(order) ?? 0) + 1);
  }
  return counts;
}

describe('availability filter', () => {
  // avail-2 in the functional testing doc
  it('no shared weekday means no match', () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 11)]);
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(2, 9, 11)]);
    expect(rankCandidates(me, [ana])).toEqual([]);
  });

  // avail-3 in the functional testing doc
  it('touching times are not an overlap, but one shared minute is', () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(1, 10, 11)]);
    const ben = profile('ben', 'A_TRACK', 'GROUP', [block(1, 8, 9)]);
    expect(rankCandidates(me, [ana, ben])).toEqual([]);

    const anaOneMinute = profile('ana', 'A_TRACK', 'GROUP', [{ weekday: 1, startMinute: 599, endMinute: 660 }]);
    const result = rankCandidates(me, [anaOneMinute]);
    expect(result[0].sharedIntervals).toEqual([{ weekday: 1, startMinute: 599, endMinute: 600 }]);
  });

  // avail-4 in the functional testing doc
  it('the very start and end of the week work, and saturday night does not run into sunday', () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(0, 0, 1), block(6, 23, 24)]);
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(0, 0, 0.5), block(6, 23.5, 24)]);
    const result = rankCandidates(me, [ana]);
    expect(result[0].overlapCount).toBe(2);
    expect(result[0].sharedIntervals).toEqual([
      { weekday: 0, startMinute: 0, endMinute: 30 },
      { weekday: 6, startMinute: 1410, endMinute: 1440 },
    ]);

    const meSatOnly = profile('me', 'A_TRACK', 'GROUP', [block(6, 23, 24)]);
    const benSunOnly = profile('ben', 'A_TRACK', 'GROUP', [block(0, 0, 1)]);
    expect(rankCandidates(meSatOnly, [benSunOnly])).toEqual([]);
  });

  // avail-5 in the functional testing doc
  it("one block hitting two of theirs counts once, and my repeated blocks can't inflate it", () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 12)]);
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(1, 11, 12)]);
    const first = rankCandidates(me, [ana]);
    expect(first[0].overlapCount).toBe(1);
    expect(first[0].sharedIntervals).toEqual([block(1, 9, 10), block(1, 11, 12)]);

    const meTwice = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(1, 9, 10)]);
    const anaHour = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
    expect(rankCandidates(meTwice, [anaHour])[0].overlapCount).toBe(1);
    // my saved blocks are left alone
    expect(meTwice.blocks).toEqual([block(1, 9, 10), block(1, 9, 10)]);
  });
});

describe('overlap ranking', () => {
  // rank-2 in the functional testing doc
  it('ranking counts shared blocks, not total shared hours', () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 12), block(2, 9, 9.5), block(3, 9, 9.5)]);
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 12)]);
    const ben = profile('ben', 'A_TRACK', 'GROUP', [block(2, 9, 9.5), block(3, 9, 9.5)]);
    expect(ids(rankCandidates(me, [ana, ben]))).toEqual(['ben', 'ana']);
  });

  // rank-3 in the functional testing doc
  it('more overlap wins even over a matching work style', () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(2, 9, 10)]);
    const ana = profile('ana', 'A_TRACK', 'SOLO', [block(1, 9, 10), block(2, 9, 10)]);
    const ben = profile('ben', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
    expect(ids(rankCandidates(me, [ben, ana]))).toEqual(['ana', 'ben']);
  });
});

describe('work style tie break', () => {
  // style-1 in the functional testing doc
  it('same work style goes first when overlap is tied, 100 runs each way', () => {
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
    const ben = profile('ben', 'A_TRACK', 'SOLO', [block(1, 9, 10)]);
    const meSolo = profile('me', 'A_TRACK', 'SOLO', [block(1, 9, 10)]);
    const meGroup = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);

    for (let i = 0; i < 100; i++) {
      expect(ids(rankCandidates(meSolo, [ana, ben]))).toEqual(['ben', 'ana']);
      expect(ids(rankCandidates(meGroup, [ben, ana]))).toEqual(['ana', 'ben']);
    }
  });

  // style-2 in the functional testing doc
  it('work style only reorders inside the same overlap count', () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(2, 9, 10)]);
    const dee = profile('dee', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(2, 9, 10)]);
    const ana = profile('ana', 'A_TRACK', 'SOLO', [block(1, 9, 10), block(2, 9, 10)]);
    const ben = profile('ben', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
    const cal = profile('cal', 'A_TRACK', 'SOLO', [block(1, 9, 10)]);

    for (let i = 0; i < 100; i++) {
      expect(ids(rankCandidates(me, [cal, ana, ben, dee]))).toEqual(['dee', 'ana', 'ben', 'cal']);
    }
  });
});

describe('random tie break', () => {
  const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
  const ana = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
  const ben = profile('ben', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
  const cal = profile('cal', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);

  // rand-1 in the functional testing doc
  it('shuffling never drops or repeats anyone, and all 6 orders show up about evenly', () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 6000; i++) {
      const order = ids(rankCandidates(me, [ana, ben, cal]));
      // the required check: everyone exactly once
      expect([...order].sort()).toEqual(['ana', 'ben', 'cal']);
      const key = order.join(',');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(6);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThanOrEqual(800);
      expect(n).toBeLessThanOrEqual(1200);
    }
  });

  // rand-2 in the functional testing doc
  it('the same random numbers always give the same order', () => {
    // worked out by hand from the shuffle in stages.ts:
    // always 0 swaps every time, always 0.99 never swaps
    const low = () => 0;
    const high = () => 0.99;
    expect(ids(rankCandidates(me, [ana, ben, cal], low))).toEqual(['ben', 'cal', 'ana']);
    expect(ids(rankCandidates(me, [ana, ben, cal], low))).toEqual(['ben', 'cal', 'ana']);
    expect(ids(rankCandidates(me, [ana, ben, cal], high))).toEqual(['ana', 'ben', 'cal']);
    expect(ids(rankCandidates(me, [ana, ben, cal], high))).toEqual(['ana', 'ben', 'cal']);
  });

  // rand-3 in the functional testing doc
  it('only people tied on both overlap and work style get shuffled', () => {
    const me2 = profile('me', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(2, 9, 10)]);
    const ana2 = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(2, 9, 10)]);
    const dee = profile('dee', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);
    const eve = profile('eve', 'A_TRACK', 'SOLO', [block(1, 9, 10)]);

    const counts = countOrders(me2, [eve, dee, cal, ben, ana2], 1000);
    for (const order of counts.keys()) {
      const list = order.split(',');
      expect(list[0]).toBe('ana');
      expect(list[4]).toBe('eve');
      expect(list.slice(1, 4).sort()).toEqual(['ben', 'cal', 'dee']);
    }
    // more than one order is expected. only one would mean the shuffle isn't running
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe('rule order', () => {
  // order-1 in the functional testing doc
  it('each of the five rules decides at least one spot', () => {
    const days = [block(1, 9, 10), block(2, 9, 10), block(3, 9, 10)];
    const me = profile('me', 'A_TRACK', 'GROUP', days);
    const ana = profile('ana', 'PASS_TRACK', 'GROUP', days);
    const ben = profile('ben', 'A_TRACK', 'GROUP', [block(5, 9, 10)]);
    const cal = profile('cal', 'A_TRACK', 'SOLO', days);
    const dee = profile('dee', 'A_TRACK', 'GROUP', [block(1, 9, 10), block(2, 9, 10)]);
    const eve = profile('eve', 'A_TRACK', 'SOLO', [block(1, 9, 10), block(2, 9, 10)]);
    const fin = profile('fin', 'A_TRACK', 'GROUP', [block(3, 9, 10)]);
    const gil = profile('gil', 'A_TRACK', 'GROUP', [block(3, 9, 10)]);

    const counts = countOrders(me, [gil, fin, eve, dee, cal, ben, ana, me], 100);
    for (const order of counts.keys()) {
      const list = order.split(',');
      expect(list.slice(0, 3)).toEqual(['cal', 'dee', 'eve']);
      expect(list.slice(3).sort()).toEqual(['fin', 'gil']);
    }
    // both fin and gil orders should come up over 100 runs
    expect(counts.size).toBe(2);
  });
});

describe('shared times shown on the card', () => {
  // view-2 in the functional testing doc
  it("only the shared hour shows, never the classmate's whole day", () => {
    const me = profile('me', 'A_TRACK', 'GROUP', [block(1, 12, 13)]);
    const ana = profile('ana', 'A_TRACK', 'GROUP', [block(1, 9, 17), block(2, 9, 17)]);
    expect(rankCandidates(me, [ana])[0].sharedIntervals).toEqual([block(1, 12, 13)]);
  });
});

describe('eligibility on the sample data', () => {
  // elig-1 in the functional testing doc
  it('isEligible on the sample students', async () => {
    const all = await mock.getCourseProfiles('1');
    const get = (id: string) => all.find((p) => p.studentId === id)!;
    const s101 = get('101');

    expect(isEligible(s101, get('102'))).toBe(true);
    expect(isEligible(s101, get('104'))).toBe(false); // pass track
    expect(isEligible(s101, get('105'))).toBe(false); // friday only
    expect(isEligible(s101, { ...get('102'), blocks: [block(5, 10, 12)] })).toBe(false);
    expect(isEligible(s101, { ...get('102'), courseId: '2' })).toBe(false);
    expect(isEligible(s101, s101)).toBe(false);
  });

  // elig-2 in the functional testing doc
  it('the candidate list and isEligible always agree', async () => {
    const all = await mock.getCourseProfiles('1');
    const expected: Record<string, string[]> = {
      '101': ['102', '103', '106'],
      '102': ['101'],
      '103': ['101'],
      '106': ['101'],
      '104': [],
      '105': [],
    };

    for (const [me, want] of Object.entries(expected)) {
      const listed = (await findCandidates(me, '1')).map((c) => c.candidateId).sort();
      const sender = all.find((p) => p.studentId === me)!;
      const eligible = all.filter((p) => isEligible(sender, p)).map((p) => p.studentId).sort();
      expect(listed).toEqual(want);
      expect(eligible).toEqual(want);
    }
  });
});

describe('review averages and bad data', () => {
  // limit-1 in the functional testing doc
  it('changing review averages only changes what is shown, not the order', async () => {
    const before = await findCandidates('101', '1');
    expect(before.map((c) => c.candidateId)).toEqual(['102', '106', '103']);

    vi.mocked(getAverages).mockResolvedValueOnce(new Map([['102', 1.0], ['106', 5.0], ['103', 4.9]]));
    const after = await findCandidates('101', '1');
    expect(after.map((c) => c.candidateId)).toEqual(['102', '106', '103']);
    expect(after.map((c) => c.reviewAverage)).toEqual([1.0, 5.0, 4.9]);
  });

  // err-5 in the functional testing doc
  it('a review average of 7 stops the run instead of showing a wrong number', async () => {
    vi.mocked(getAverages).mockResolvedValueOnce(new Map([['102', 7]]));
    await expect(findCandidates('101', '1')).rejects.toThrow('bad review average');
  });
});

describe('list size', () => {
  // perf-2 in the functional testing doc
  it('the list is never cut short, all 199 classmates come back', async () => {
    const everyone = [];
    for (let i = 1; i <= 200; i++) {
      everyone.push(profile(String(i), 'A_TRACK', 'GROUP', [block(1, 9, 10)]));
    }
    vi.mocked(getCourseProfiles).mockResolvedValueOnce(everyone);

    const result = await findCandidates('1', '1');
    expect(result).toHaveLength(199);
    expect(result.map((c) => c.candidateId)).not.toContain('1');
  });
});
