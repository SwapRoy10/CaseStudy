import type { AvailabilityBlock, GradeGoal, WorkStyle } from '../matching/types';
import { getOwnProfile } from './profile.service';

// OwnProfile from sdd 6.2. reviewAverage is a number, or null when nobody has
// rated them yet, and the screen words that as "Not yet rated".
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

// getOwnProfile gives the average as text ("3.2" or "Not yet rated") and has nulls
// for a profile nobody saved. the api sends the sdd shape: null for no profile at all
export function toOwnProfile(saved: Saved): OwnProfile | null {
  if (saved.gradeGoal === null || saved.workStyle === null) return null;
  return {
    ...saved,
    gradeGoal: saved.gradeGoal,
    workStyle: saved.workStyle,
    reviewAverage: saved.reviewAverage === 'Not yet rated' ? null : Number(saved.reviewAverage),
  };
}
