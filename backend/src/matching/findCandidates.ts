import { StateConflictError } from './errors';
import { CandidateSummary, Id, Profile } from './types';
import { getAverages, getCourseProfiles, getProfile } from './data';
import { isValidBlock } from './availability';
import { rankCandidates } from './pipeline';
import { ScoredCandidate } from './stages';

const GRADE_GOALS: string[] = ['A_TRACK', 'PASS_TRACK'];
const WORK_STYLES: string[] = ['SOLO', 'GROUP'];

// findCandidates (sdd 6.3.4). studentId should come from the session.
// Returns every candidate that passed both filters in rank order, no cap (sdd 8.1 step 6).
// Empty list just means no matches.
export async function findCandidates(
  studentId: Id,
  courseId: Id,
  rng: () => number = Math.random
): Promise<CandidateSummary[]> {
  // TODO: do both reads in one read-only transaction so they see the same snapshot
  const requester = await getProfile(studentId, courseId);
  if (!requester || requester.blocks.length === 0) {
    throw new StateConflictError('NO_PROFILE', 'Complete your profile to see matches.');
  }
  checkProfile(requester, courseId);

  const classmates = await getCourseProfiles(courseId);
  classmates.forEach((p) => checkProfile(p, courseId));

  // a JOIN that returns one row per block would show the same person twice
  if (new Set(classmates.map((p) => p.studentId)).size !== classmates.length) {
    throw new Error(`duplicate profiles returned for course ${courseId}`);
  }

  const ranked = rankCandidates(requester, classmates, rng);

  // averages get added after ranking so they can't change the order (CO-3)
  const averages = await getAverages(ranked.map((c) => c.studentId));
  return ranked.map((c) => {
    // no entry means no reviews yet, anything else has to be a real 1-5 rating
    const avg = averages.has(c.studentId) ? averages.get(c.studentId)! : null;
    if (avg !== null && !(typeof avg === 'number' && avg >= 1 && avg <= 5)) {
      throw new Error(`bad review average for student ${c.studentId}`);
    }
    return toSummary(c, avg);
  });
}

// If the db layer hands back rows in the wrong shape (snake_case columns, 'A track'
// instead of A_TRACK, another course, bad blocks) matching would just quietly give
// wrong results or an empty list. Throwing means it shows up as UNAVAILABLE and
// gets logged instead (sdd 10.1, 10.3). Only ids in the message (sdd 9.8).
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

// copy only the public fields so nothing internal like overlapCount gets sent
function toSummary(c: ScoredCandidate, reviewAverage: number | null): CandidateSummary {
  return {
    candidateId: c.studentId,
    gradeGoal: c.gradeGoal,
    workStyle: c.workStyle,
    sharedIntervals: c.sharedIntervals,
    reviewAverage,
  };
}
