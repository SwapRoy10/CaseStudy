import { describe, expect, it, vi } from 'vitest';
import { findCandidates } from './findCandidates';
import { getCourseProfiles } from './data';

// runs against the mock data in data.ts, only getCourseProfiles is wrapped
// so one test can make it fail
vi.mock('./data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data')>();
  return { ...actual, getCourseProfiles: vi.fn(actual.getCourseProfiles) };
});

describe('findCandidates', () => {
  it('returns ranked candidates for the requester', async () => {
    const result = await findCandidates('101', '1');
    // 102 overlaps Mon + Wed. 106 and 103 overlap once, 106 wins on work style.
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
});
