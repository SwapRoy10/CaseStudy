import { Prisma } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { prisma } from '../db';
import { ForbiddenError, ValidationError } from '../errors';
import { getGroup } from '../requests/groups.service';
import { makeClass, match } from '../requests/testUtils';
import { REVIEW_CRITERIA } from './criteria';
import { submitReview } from './reviews.service';

// ratings for every criterion, all the same number unless told otherwise
const rate = (rating: number) => REVIEW_CRITERIA.map((criteriaName) => ({ criteriaName, rating }));

describe.skipIf(config.useMockData)('peer reviews', () => {
  let courseId: bigint;
  let course: string;
  let ids: bigint[];
  let groupId: string;
  let cleanup: () => Promise<void>;
  const [a, b, c, d] = [0, 1, 2, 3];

  // a, b and c are in one group, d is on the roster but in none
  beforeEach(async () => {
    const made = await makeClass(`rv${Date.now()}${Math.floor(Math.random() * 1000)}`, [{}, {}, {}, {}]);
    courseId = made.courseId;
    course = courseId.toString();
    ids = made.ids;
    cleanup = made.cleanup;
    await match(courseId, ids[a], ids[b]);
    await match(courseId, ids[a], ids[c]);
    groupId = (await getGroup(ids[a], course))!.groupId;
  });

  afterEach(async () => {
    await cleanup();
  });

  const review = (reviewer: number, reviewee: number, ratings: unknown = rate(4)) =>
    submitReview(ids[reviewer], groupId, { revieweeId: ids[reviewee].toString(), ratings });

  it('reports a duplicate review when the database rejects a competing insert', async () => {
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate review', { code: 'P2002', clientVersion: Prisma.prismaVersion.client }),
    );
    try {
      await expect(review(a, b)).rejects.toMatchObject({ code: 'DUPLICATE_REVIEW' });
    } finally {
      transaction.mockRestore();
    }
  });

  describe('submitting', () => {
    it('saves one rating per criterion and gives back the average', async () => {
      const result = await review(a, b, [
        { criteriaName: 'Communication', rating: 5 },
        { criteriaName: 'Reliability', rating: 4 },
        { criteriaName: 'Contribution', rating: 3 },
      ]);

      expect(result.revieweeAverage).toBe(4);
      const saved = await prisma.peerReview.findUniqueOrThrow({
        where: { id: BigInt(result.reviewId) },
        include: { ratings: true },
      });
      expect(saved).toMatchObject({ reviewerId: ids[a], revieweeId: ids[b], groupId: BigInt(groupId) });
      expect(saved.ratings.map((r) => [r.criteriaName, r.rating]).sort()).toEqual([
        ['Communication', 5],
        ['Contribution', 3],
        ['Reliability', 4],
      ]);
    });

    it('works in any order of criteria', async () => {
      const result = await review(a, b, [...rate(2)].reverse());
      expect(result.revieweeAverage).toBe(2);
    });

    it('averages every rating the student has received, from everyone', async () => {
      await review(a, b, rate(5));
      const second = await review(c, b, rate(2));
      // 3 ratings of 5 and 3 ratings of 2 is 3.5
      expect(second.revieweeAverage).toBe(3.5);
    });

    it('lets the same two students review each other', async () => {
      await review(a, b);
      await expect(review(b, a)).resolves.toBeDefined();
    });

    it('does not move the average for anyone else', async () => {
      await review(a, b, rate(1));
      const own = await review(b, c, rate(5));
      expect(own.revieweeAverage).toBe(5);
    });
  });

  describe('the ratings have to be right', () => {
    it('needs every criterion', async () => {
      await expect(review(a, b, rate(4).slice(1))).rejects.toThrow(ValidationError);
      await expect(review(a, b, [])).rejects.toThrow(ValidationError);
    });

    it('does not take extra or unknown criteria', async () => {
      await expect(review(a, b, [...rate(4), { criteriaName: 'Punctuality', rating: 4 }])).rejects.toThrow(ValidationError);
      await expect(review(a, b, [...rate(4).slice(1), { criteriaName: 'Punctuality', rating: 4 }])).rejects.toThrow(ValidationError);
    });

    it('does not take the same criterion twice', async () => {
      await expect(review(a, b, [...rate(4).slice(1), ...rate(4).slice(1)])).rejects.toThrow(ValidationError);
    });

    it('only takes whole numbers from 1 to 5', async () => {
      for (const bad of [0, 6, -1, 3.5, '4' as unknown as number]) {
        await expect(review(a, b, rate(4).map((r, i) => (i === 0 ? { ...r, rating: bad } : r)))).rejects.toThrow(ValidationError);
      }
      // 1 and 5 are fine
      await expect(review(a, b, rate(1))).resolves.toBeDefined();
      await expect(review(c, b, rate(5))).resolves.toBeDefined();
    });

    it('names the bad field, and saves nothing', async () => {
      await expect(submitReview(ids[a], groupId, { revieweeId: ids[b].toString() })).rejects.toMatchObject({ fields: ['ratings'] });
      await expect(submitReview(ids[a], groupId, {})).rejects.toMatchObject({ fields: ['revieweeId', 'ratings'] });
      expect(await prisma.peerReview.count({ where: { groupId: BigInt(groupId) } })).toBe(0);
    });

    it('rejects an id that is not a number', async () => {
      await expect(submitReview(ids[a], 'abc', { revieweeId: ids[b].toString(), ratings: rate(4) })).rejects.toThrow(ValidationError);
      await expect(submitReview(ids[a], groupId, { revieweeId: 'abc', ratings: rate(4) })).rejects.toThrow(ValidationError);
    });
  });

  describe('who can review whom', () => {
    it('not yourself', async () => {
      await expect(review(a, a)).rejects.toThrow(ForbiddenError);
      expect(await prisma.peerReview.count({ where: { groupId: BigInt(groupId) } })).toBe(0);
    });

    it('not someone outside the group', async () => {
      await expect(review(a, d)).rejects.toThrow(ForbiddenError);
    });

    it('not if you are outside the group', async () => {
      await expect(review(d, a)).rejects.toThrow(ForbiddenError);
    });

    it('not in a group that does not exist, which looks the same as one you are not in', async () => {
      await expect(submitReview(ids[a], '999999999', { revieweeId: ids[b].toString(), ratings: rate(4) })).rejects.toThrow(ForbiddenError);
    });

    it('not once one of you has left the group', async () => {
      await prisma.groupMembership.deleteMany({ where: { studentId: ids[b] } });
      await expect(review(a, b)).rejects.toThrow(ForbiddenError);
    });
  });

  describe('only once', () => {
    it('refuses a second review of the same person in the same group', async () => {
      await review(a, b, rate(5));
      await expect(review(a, b, rate(1))).rejects.toMatchObject({ code: 'DUPLICATE_REVIEW' });
      // the first one stands
      expect(await prisma.peerReview.count({ where: { reviewerId: ids[a], revieweeId: ids[b] } })).toBe(1);
      expect(await prisma.ratingCriterion.count({ where: { review: { reviewerId: ids[a], revieweeId: ids[b] } } })).toBe(REVIEW_CRITERIA.length);
    });

    it('lets only one of two submitted at the same moment through', async () => {
      const results = await Promise.allSettled([review(a, b, rate(5)), review(a, b, rate(1))]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failed.reason.code).toBe('DUPLICATE_REVIEW');
      expect(await prisma.peerReview.count({ where: { reviewerId: ids[a], revieweeId: ids[b] } })).toBe(1);
    });
  });
});
