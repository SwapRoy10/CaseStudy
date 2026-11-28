// collaborative code by somesh and claude sonnet 5.5

import type { AvailabilityBlock, GradeGoal, WorkStyle } from '../matching/types';
import { getOwnProfile } from './profile.service';

// OwnProfile from sdd 6.2, reviewAverage is null until someone rates them
export interface OwnProfile {
  courseId: string;
  name: string;
  schoolEmail: string;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  blocks: AvailabilityBlock[];
  reviewAverage: number | null;
}

type Saved = Awaited<ReturnType<typeof getOwnProfile>>;

// turns getOwnProfile's text average and nulls into the sdd shape
export function toOwnProfile(saved: Saved): OwnProfile | null {
  if (saved.gradeGoal === null || saved.workStyle === null) return null; // nothing saved yet
  return {
    ...saved,
    gradeGoal: saved.gradeGoal,
    workStyle: saved.workStyle,
    reviewAverage: saved.reviewAverage === 'Not yet rated' ? null : Number(saved.reviewAverage), // text to number
  };
}
