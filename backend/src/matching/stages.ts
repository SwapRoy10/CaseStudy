import { AvailabilityBlock, GradeGoal, Id, Profile, WorkStyle } from './types';
import { normalizeBlocks, sharedIntersections } from './availability';

// passed between stages 2 to 5, never sent to the client
export interface ScoredCandidate {
  studentId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  sharedIntervals: AvailabilityBlock[];
  overlapCount: number;
}

// stage 1, Match.Filter.Grade, also drops the requester
export function filterByGradeGoal(requester: Profile, classmates: Profile[]): Profile[] {
  return classmates.filter(
    (p) => p.studentId !== requester.studentId && p.gradeGoal === requester.gradeGoal
  );
}

// stage 2, Match.Filter.Availability
export function filterByAvailability(requester: Profile, candidates: Profile[]): ScoredCandidate[] {
  // normalize so a duplicate block in the requester's profile can't count twice
  const requesterBlocks = normalizeBlocks(requester.blocks);
  const result: ScoredCandidate[] = [];

  for (const c of candidates) {
    const shared = sharedIntersections(requesterBlocks, c.blocks);
    if (shared.intervals.length === 0) continue; // no shared time, drop them

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

// stage 3, Match.Rank.Overlap, most overlap first
export function rankByOverlap(candidates: ScoredCandidate[]): ScoredCandidate[] {
  return [...candidates].sort((a, b) => b.overlapCount - a.overlapCount);
}

// stage 4, Match.Tie.WorkStyle, needs stage 3 order, only reorders ties
export function tieBreakByWorkStyle(requester: Profile, candidates: ScoredCandidate[]): ScoredCandidate[] {
  const groups = splitTies(candidates, (a, b) => a.overlapCount === b.overlapCount); // runs of equal overlap

  return groups.flatMap((group) =>
    [...group].sort((a, b) => Number(sameStyle(requester, b)) - Number(sameStyle(requester, a))) // same style first
  );
}

// stage 5, Match.Tie.Random, shuffles ties, rng is a parameter for tests
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

// splits sorted scores into tie runs, [3, 2, 2, 1] to [[3], [2, 2], [1]]
function splitTies(
  list: ScoredCandidate[],
  isTied: (a: ScoredCandidate, b: ScoredCandidate) => boolean
): ScoredCandidate[][] {
  const groups: ScoredCandidate[][] = [];
  for (const item of list) {
    const group = groups[groups.length - 1];
    if (group && isTied(group[group.length - 1], item)) {
      group.push(item); // ties the last one in the run
    } else {
      groups.push([item]);
    }
  }
  return groups;
}

// fisher-yates shuffle on a copy
function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); // pick from the unshuffled part
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
