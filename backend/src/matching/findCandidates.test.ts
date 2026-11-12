import { describe, expect, it, vi } from 'vitest';
import { findCandidates } from './findCandidates';
import { getAverages, getCourseProfiles } from './data';
import { block, profile } from './testUtils';

// runs against the mock data in mockData.ts. the functions are wrapped so a test
// can swap in one bad response with mockResolvedValueOnce
vi.mock('./data', async () => {
  const mock = await import('./mockData.js');
  return {
    ...mock,
    getCourseProfiles: vi.fn(mock.getCourseProfiles),
    getAverages: vi.fn(mock.getAverages),
  };
});

describe('findCandidates', () => {
  it('returns ranked candidates for the requester', async () => {
    const result = await findCandidates('101', '1');
    // 102 overlaps mon + wed. 106 and 103 overlap once, 106 wins on work style.
    // 104 is pass track, 105 has no overlap, 107 has no availability.
    expect(result.map((c) => c.candidateId)).toEqual(['102', '106', '103']);
  });

  it('attaches review averages, null when not rated', async () => {
    const result = await findCandidates('101', '1');
    expect(result[0].reviewAverage).toBe(3.2);
    expect(result[1].reviewAverage).toBeNull();
    expect(result[2].reviewAverage).toBe(4.9);
  });

  it("review average doesn't affect the order (CO-3)", async () => {
    // 103 has the highest average but still comes last
    const result = await findCandidates('101', '1');
    expect(result[result.length - 1].candidateId).toBe('103');
  });

  it('only returns the limited summary fields', async () => {
    const result = await findCandidates('101', '1');
    for (const c of result) {
      expect(Object.keys(c).sort()).toEqual([
        'candidateId',
        'gradeGoal',
        'reviewAverage',
        'sharedIntervals',
        'workStyle',
      ]);
      for (const interval of c.sharedIntervals) {
        expect(Object.keys(interval).sort()).toEqual(['endMinute', 'startMinute', 'weekday']);
      }
    }
  });

  it('returns an empty list when nobody passes the filters', async () => {
    expect(await findCandidates('104', '1')).toEqual([]);
  });

  it('throws NO_PROFILE when the requester has no profile', async () => {
    await expect(findCandidates('999', '1')).rejects.toMatchObject({ reason: 'NO_PROFILE' });
  });

  it('throws NO_PROFILE when the profile has no availability', async () => {
    await expect(findCandidates('107', '1')).rejects.toMatchObject({ reason: 'NO_PROFILE' });
  });

  it('a failed read throws instead of returning an empty list', async () => {
    vi.mocked(getCourseProfiles).mockRejectedValueOnce(new Error('connection refused'));
    await expect(findCandidates('101', '1')).rejects.toThrow('connection refused');
  });

  // nfr-perf-1: ranked list in under 3 seconds for a class of 200. this only times
  // the matching code, the real endpoint test with postgres is in sdd 8.3
  it('ranks a class of 200 students well under 3 seconds', async () => {
    const big = [];
    for (let i = 1; i <= 200; i++) {
      // everyone gets eight 30 min blocks spread over mon to fri, shifted a bit per
      // student so overlap counts differ and the sort has real work to do
      const blocks = [];
      for (let k = 0; k < 8; k++) {
        const day = 1 + (k % 5);
        const start = 8 + ((i + k) % 10) / 2;
        blocks.push(block(day, start, start + 0.5));
      }
      big.push(profile(String(i), i % 4 === 0 ? 'PASS_TRACK' : 'A_TRACK', i % 2 ? 'SOLO' : 'GROUP', blocks));
    }
    vi.mocked(getCourseProfiles).mockResolvedValueOnce(big);

    const started = performance.now();
    const result = await findCandidates('1', '1');
    const took = performance.now() - started;

    expect(result.length).toBeGreaterThan(0);
    expect(took).toBeLessThan(3000);
  });
});

// these are for mistakes in the real db layer later. without the checks each of
// these would give wrong matches or an empty list instead of an error.
describe('findCandidates with bad data from the db layer', () => {
  const ok = profile('201', 'A_TRACK', 'GROUP', [block(1, 9, 10)]);

  it('throws if a classmate from another course comes back', async () => {
    vi.mocked(getCourseProfiles).mockResolvedValueOnce([{ ...ok, courseId: '2' }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('bad profile data');
  });

  it("throws on enums spelled the way the srs writes them ('A track', 'solo')", async () => {
    vi.mocked(getCourseProfiles).mockResolvedValueOnce([{ ...ok, gradeGoal: 'A track' as any }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('bad profile data');

    vi.mocked(getCourseProfiles).mockResolvedValueOnce([{ ...ok, workStyle: 'solo' as any }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('bad profile data');
  });

  it('throws on a numeric student id', async () => {
    vi.mocked(getCourseProfiles).mockResolvedValueOnce([{ ...ok, studentId: 201 as any }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('bad profile data');
  });

  it('throws on a block with start after end', async () => {
    vi.mocked(getCourseProfiles).mockResolvedValueOnce([{ ...ok, blocks: [block(1, 10, 9)] }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('bad profile data');
  });

  it("throws if the requester's own profile is bad", async () => {
    vi.mocked(getCourseProfiles).mockResolvedValueOnce([{ ...ok, studentId: '101', blocks: [block(7, 9, 10)] }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('bad profile data');
  });

  it('throws if the same student comes back twice', async () => {
    vi.mocked(getCourseProfiles).mockResolvedValueOnce([ok, { ...ok, blocks: [block(3, 13, 14)] }]);
    await expect(findCandidates('101', '1')).rejects.toThrow('duplicate profiles');
  });

  it('throws on a review average that is not null or 1-5', async () => {
    // a numeric column can come back as a string, 0 would look like a real rating
    for (const bad of ['3.2', 0, NaN, undefined]) {
      vi.mocked(getAverages).mockResolvedValueOnce(new Map([['102', bad as any]]));
      await expect(findCandidates('101', '1')).rejects.toThrow('bad review average');
    }
  });
});
