import { Profile } from './types';
import {
  ScoredCandidate,
  filterByAvailability,
  filterByGradeGoal,
  randomTieBreak,
  rankByOverlap,
  tieBreakByWorkStyle,
} from './stages';

// the five rules in srs Match.RuleOrder, nothing else changes the result
export function rankCandidates(
  requester: Profile,
  classmates: Profile[],
  rng: () => number = Math.random
): ScoredCandidate[] {
  const sameGoal = filterByGradeGoal(requester, classmates);

  let ranked = filterByAvailability(requester, sameGoal);
  ranked = rankByOverlap(ranked);
  ranked = tieBreakByWorkStyle(requester, ranked);
  ranked = randomTieBreak(requester, ranked, rng);

  return ranked;
}

// used before a request is saved (sdd 3.3), false for yourself too
export function isEligible(sender: Profile, recipient: Profile): boolean {
  if (sender.courseId !== recipient.courseId) return false;

  const sameGoal = filterByGradeGoal(sender, [recipient]);
  return filterByAvailability(sender, sameGoal).length > 0;
}
