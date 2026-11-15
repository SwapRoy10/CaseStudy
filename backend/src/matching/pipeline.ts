import { Profile } from './types';
import {
  ScoredCandidate,
  filterByAvailability,
  filterByGradeGoal,
  randomTieBreak,
  rankByOverlap,
  tieBreakByWorkStyle,
} from './stages';

// the five rules in the order from srs Match.RuleOrder.
// nothing else is allowed to affect the result (Match.CriteriaLimit),
// so review averages stay out of here.
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

// eligibility check the requests module calls before saving a request (sdd 3.3).
// the recipient has to be in the same course and still pass the grade and
// availability filters. also false for yourself, since stage 1 drops the requester.
export function isEligible(sender: Profile, recipient: Profile): boolean {
  if (sender.courseId !== recipient.courseId) return false;

  const sameGoal = filterByGradeGoal(sender, [recipient]);
  return filterByAvailability(sender, sameGoal).length > 0;
}
