// original code by somesh, written by hand

import { StateConflictError } from './errors';
import { CandidateSummary, Id, Profile } from './types';
import { getAverages, getCourseProfiles } from './data';
import { isValidBlock } from './availability';
import { rankCandidates } from './pipeline';
import { ScoredCandidate } from './stages';

const GRADE_GOALS: string[] = ['A_TRACK', 'PASS_TRACK'];
const WORK_STYLES: string[] = ['SOLO', 'GROUP'];

// sdd 6.3.4, ranked candidates passing both filters, no cap (sdd 8.1)
export async function findCandidates(
  studentId: Id,
  courseId: Id,
  rng: () => number = Math.random
): Promise<CandidateSummary[]> {
  // one query, one snapshot, requester included (sdd 3.3)
  const classmates = await getCourseProfiles(courseId);
  classmates.forEach((p) => checkProfile(p, courseId));

  // a join with one row per block would list the same person twice
  if (new Set(classmates.map((p) => p.studentId)).size !== classmates.length) {
    throw new Error(`duplicate profiles returned for course ${courseId}`);
  }

  const requester = classmates.find((p) => p.studentId === studentId);
  if (!requester) { // no saved profile with a free time
    throw new StateConflictError('NO_PROFILE', 'Complete your profile to see matches.');
  }

  const ranked = rankCandidates(requester, classmates, rng);

  // averages added after ranking so they can't change the order (CO-3)
  const averages = await getAverages(ranked.map((c) => c.studentId));
  return ranked.map((c) => {
    // no entry means no reviews yet, else it must be a real 1-5 rating
    const avg = averages.has(c.studentId) ? averages.get(c.studentId)! : null;
    if (avg !== null && !(typeof avg === 'number' && avg >= 1 && avg <= 5)) {
      throw new Error(`bad review average for student ${c.studentId}`);
    }
    return toSummary(c, avg);
  });
}

// bad db rows throw (UNAVAILABLE, sdd 10.3), only ids in the message
function checkProfile(p: Profile, courseId: Id) {
  const ok =
    typeof p.studentId === 'string' &&
    p.courseId === courseId &&
    GRADE_GOALS.includes(p.gradeGoal) &&
    WORK_STYLES.includes(p.workStyle) &&
    p.blocks.every(isValidBlock);

  if (!ok) {
    throw new Error(`bad profile data for student ${p.studentId} in course ${courseId}`);
  }
}

// public fields only, so overlapCount never gets sent
function toSummary(c: ScoredCandidate, reviewAverage: number | null): CandidateSummary {
  return {
    candidateId: c.studentId,
    gradeGoal: c.gradeGoal,
    workStyle: c.workStyle,
    sharedIntervals: c.sharedIntervals,
    reviewAverage,
  };
}
