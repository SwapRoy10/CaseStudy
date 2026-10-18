import { StateConflictError } from './errors';
import { CandidateSummary, Id } from './types';
import { getAverage, getCourseProfiles, getProfile } from './data';
import { rankCandidates } from './pipeline';
import { ScoredCandidate } from './stages';

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

  const classmates = await getCourseProfiles(courseId);
  const ranked = rankCandidates(requester, classmates, rng);

  // averages get added after ranking so they can't change the order (CO-3)
  // TODO: batch this once getAverage is a real query
  const summaries: CandidateSummary[] = [];
  for (const c of ranked) {
    summaries.push(toSummary(c, await getAverage(c.studentId)));
  }
  return summaries;
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
