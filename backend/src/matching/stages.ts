import { AvailabilityBlock, GradeGoal, Id, Profile, WorkStyle } from './types';
import { normalizeBlocks, sharedIntersections } from './availability';

// What gets passed between stages 2-5. This never goes to the client,
// findCandidates turns it into a CandidateSummary at the end.
export interface ScoredCandidate {
  studentId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  sharedIntervals: AvailabilityBlock[];
  overlapCount: number;
}

// Stage 1 - Match.Filter.Grade
// Also drops the requester, since they're in the course profile list too.
export function filterByGradeGoal(requester: Profile, classmates: Profile[]): Profile[] {
  return classmates.filter(
    (p) => p.studentId !== requester.studentId && p.gradeGoal === requester.gradeGoal
  );
}

// Stage 2 - Match.Filter.Availability
export function filterByAvailability(requester: Profile, candidates: Profile[]): ScoredCandidate[] {
  // saved blocks should already be canonical, but normalize anyway so the count
  // is right even if they aren't (e.g. 9-10 and 10-11 count as one block)
  const requesterBlocks = normalizeBlocks(requester.blocks);
  const result: ScoredCandidate[] = [];

  for (const c of candidates) {
    const shared = sharedIntersections(requesterBlocks, normalizeBlocks(c.blocks));
    if (shared.intervals.length === 0) continue;

    result.push({
      studentId: c.studentId,
      gradeGoal: c.gradeGoal,
      workStyle: c.workStyle,
      sharedIntervals: shared.intervals,
      overlapCount: shared.overlapCount,
    });
  }

  return result;
}

// Stage 3 - Match.Rank.Overlap, most overlap first
export function rankByOverlap(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((a, b) => b.overlapCount - a.overlapCount);
}

// Stage 4 - Match.Tie.WorkStyle
// Expects the list already sorted by stage 3. Only reorders within each overlap-count group.
export function tieBreakByWorkStyle(requester: Profile, candidates: ScoredCandidate[]): ScoredCandidate[] {
  const groups = splitTies(candidates, (a, b) => a.overlapCount === b.overlapCount);

  return groups.flatMap((group) =>
    [...group].sort((a, b) => Number(sameStyle(requester, b)) - Number(sameStyle(requester, a)))
  );
}

// Stage 5 - Match.Tie.Random
// Shuffles candidates still tied on overlap count and work style.
// rng is a parameter so tests can control the order.
export function randomTieBreak(
  requester: Profile,
  candidates: ScoredCandidate[],
  rng: () => number
): ScoredCandidate[] {
  const groups = splitTies(
    candidates,
    (a, b) => a.overlapCount === b.overlapCount && sameStyle(requester, a) === sameStyle(requester, b)
  );

  return groups.flatMap((group) => shuffle(group, rng));
}

function sameStyle(requester: Profile, c: ScoredCandidate): boolean {
  return c.workStyle === requester.workStyle;
}

// Splits an already sorted list into runs of tied neighbours.
// e.g. counts [3, 2, 2, 1] -> [[3], [2, 2], [1]]
function splitTies(
  list: ScoredCandidate[],
  isTied: (a: ScoredCandidate, b: ScoredCandidate) => boolean
): ScoredCandidate[][] {
  const groups: ScoredCandidate[][] = [];
  for (const item of list) {
    const group = groups[groups.length - 1];
    if (group && isTied(group[group.length - 1], item)) {
      group.push(item);
    } else {
      groups.push([item]);
    }
  }
  return groups;
}

// Fisher-Yates shuffle on a copy
function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
