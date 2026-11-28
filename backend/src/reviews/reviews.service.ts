// collaborative code by somesh and claude sonnet 5.5

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db';
import { ForbiddenError, StateConflictError, ValidationError, toId } from '../errors';
import { lockEnrollments } from '../enrollment/lock';
import { REVIEW_CRITERIA } from './criteria';

// peer reviews (sdd 5.3, 6.3.11), the reviewer is the signed in student

export const reviewInputSchema = z.object({
  revieweeId: z.string().regex(/^\d+$/),
  ratings: z.array(z.object({ criteriaName: z.string(), rating: z.number().int().min(1).max(5) })),
});

export async function submitReview(reviewerId: bigint, groupIdRaw: string, input: unknown) {
  const groupId = toId(groupIdRaw, 'groupId');

  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'body');
    throw new ValidationError([...new Set(fields)]);
  }
  const revieweeId = BigInt(parsed.data.revieweeId);
  const { ratings } = parsed.data;

  // exactly one rating per criterion (Review.Scale)
  const names = ratings.map((r) => r.criteriaName);
  const exact = names.length === REVIEW_CRITERIA.length && REVIEW_CRITERIA.every((c) => names.includes(c));
  if (!exact) throw new ValidationError(['ratings']);

  if (revieweeId === reviewerId) throw new ForbiddenError(); // no self reviews

  // a missing group looks the same as one you're not in
  const group = await prisma.studyGroup.findUnique({ where: { id: groupId } });
  if (!group) throw new ForbiddenError();

  const [first, second] = reviewerId < revieweeId ? [reviewerId, revieweeId] : [revieweeId, reviewerId];
  try {
    return await prisma.$transaction(async (tx) => {
      // lock both students, then check membership as it is now
      if (!(await lockEnrollments(tx, group.courseId, first, second))) throw new ForbiddenError();
      const members = await tx.groupMembership.count({
        where: { groupId, studentId: { in: [reviewerId, revieweeId] } },
      });
      if (members < 2) throw new ForbiddenError(); // both must be in the group

      const already = await tx.peerReview.findUnique({
        where: { reviewerId_revieweeId_groupId: { reviewerId, revieweeId, groupId } },
      });
      if (already) throw new StateConflictError('DUPLICATE_REVIEW'); // one review per pair per group

      const review = await tx.peerReview.create({
        data: { reviewerId, revieweeId, groupId, ratings: { create: ratings } },
      });

      const avg = await tx.ratingCriterion.aggregate({
        _avg: { rating: true },
        where: { review: { revieweeId } },
      });
      return { reviewId: review.id.toString(), revieweeAverage: avg._avg.rating as number };
    });
  } catch (err) {
    // the reviewer, reviewee and group key catches two submits at once
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new StateConflictError('DUPLICATE_REVIEW');
    }
    throw err;
  }
}
