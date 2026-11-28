// collaborative code by somesh and claude sonnet 5.5

import { describe, expect, it } from 'vitest';
import { toOwnProfile } from './ownProfile';

const saved = {
  courseId: '1',
  name: 'Alex Rivera',
  schoolEmail: 'axr101@case.edu',
  gradeGoal: 'A_TRACK' as const,
  workStyle: 'GROUP' as const,
  blocks: [{ weekday: 1, startMinute: 540, endMinute: 660 }],
  reviewAverage: '3.2',
};

describe('toOwnProfile', () => {
  it('is null when nothing was saved', () => {
    expect(toOwnProfile({ ...saved, gradeGoal: null, workStyle: null, blocks: [], reviewAverage: 'Not yet rated' })).toBeNull();
  });

  it('turns the text average into a number', () => {
    expect(toOwnProfile(saved)?.reviewAverage).toBe(3.2);
  });

  it('turns "Not yet rated" into null', () => {
    expect(toOwnProfile({ ...saved, reviewAverage: 'Not yet rated' })?.reviewAverage).toBeNull();
  });

  it('keeps every other field', () => {
    expect(toOwnProfile(saved)).toEqual({ ...saved, reviewAverage: 3.2 });
  });
});
