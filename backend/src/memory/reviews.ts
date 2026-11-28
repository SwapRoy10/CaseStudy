// collaborative code by somesh and claude sonnet 5.5

import { ForbiddenError, StateConflictError, ValidationError, toId } from '../errors';
import { REVIEW_CRITERIA } from '../reviews/criteria';
import { reviewInputSchema } from '../reviews/reviews.service';
import { averageFor, isEnrolled, store } from './store';

// same function as reviews/reviews.service.ts, on the in memory store

export async function submitReview(reviewerId: bigint, groupIdRaw: string, input: unknown) {
  const groupId = toId(groupIdRaw, 'groupId').toString();

  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'body');
    throw new ValidationError([...new Set(fields)]);
  }
  const reviewee = parsed.data.revieweeId;
  const { ratings } = parsed.data;
  const reviewer = reviewerId.toString();

  // one rating for every criterion, no more and no less
  const names = ratings.map((r) => r.criteriaName);
  const exact = names.length === REVIEW_CRITERIA.length && REVIEW_CRITERIA.every((c) => names.includes(c));
  if (!exact) throw new ValidationError(['ratings']);

  if (reviewee === reviewer) throw new ForbiddenError(); // no self reviews

  const group = store.groups.find((g) => g.id === groupId);
  if (!group) throw new ForbiddenError();
  const inGroup = (id: string) => store.memberships.some((m) => m.groupId === groupId && m.studentId === id);
  if (!isEnrolled(reviewer, group.courseId) || !isEnrolled(reviewee, group.courseId)) throw new ForbiddenError();
  if (!inGroup(reviewer) || !inGroup(reviewee)) throw new ForbiddenError();

  const already = store.reviews.some((r) => r.reviewerId === reviewer && r.revieweeId === reviewee && r.groupId === groupId);
  if (already) throw new StateConflictError('DUPLICATE_REVIEW');

  const id = store.nextReviewId++;
  store.reviews.push({ id, reviewerId: reviewer, revieweeId: reviewee, groupId, ratings });
  return { reviewId: String(id), revieweeAverage: averageFor(reviewee) as number };
}
