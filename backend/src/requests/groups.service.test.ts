import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config';
import { prisma } from '../db';
import { ForbiddenError, ValidationError } from '../errors';
import { REVIEW_CRITERIA } from '../reviews/criteria';
import { submitReview } from '../reviews/reviews.service';
import { getGroup, getMatchedProfile } from './groups.service';
import { cancel, respond, sendRequest } from './requests.service';
import { makeClass, match } from './testUtils';

describe.skipIf(config.useMockData)('groups and matched profiles', () => {
  let courseId: bigint;
  let course: string;
  let ids: bigint[];
  let cleanup: () => Promise<void>;
  const [a, b, c, d] = [0, 1, 2, 3];

  beforeEach(async () => {
    const made = await makeClass(`gp${Date.now()}${Math.floor(Math.random() * 1000)}`, [
      {},
      { style: 'SOLO', blocks: [[1, 9, 10], [3, 13, 15]] },
      {},
      {},
    ]);
    courseId = made.courseId;
    course = courseId.toString();
    ids = made.ids;
    cleanup = made.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  describe('getGroup', () => {
    it('is null when the student has no group', async () => {
      expect(await getGroup(ids[a], course)).toBeNull();
    });

    it('is still null after a request that was only sent, declined or canceled', async () => {
      const sent = await sendRequest(ids[a], course, ids[b].toString());
      expect(await getGroup(ids[a], course)).toBeNull();
      await respond(ids[b], sent.requestId, 'DECLINE');
      expect(await getGroup(ids[b], course)).toBeNull();
    });

    it('lists the members by name, the review criteria, and nobody reviewed yet', async () => {
      await match(courseId, ids[a], ids[b]);
      const group = await getGroup(ids[a], course);

      expect(group).toMatchObject({ courseId: course, criteria: REVIEW_CRITERIA });
      expect(new Date(group!.formedAt).toString()).not.toBe('Invalid Date');
      expect(group!.members).toEqual([
        { studentId: ids[a].toString(), name: expect.stringContaining('Student'), reviewedByMe: false },
        { studentId: ids[b].toString(), name: expect.stringContaining('Student'), reviewedByMe: false },
      ]);
    });

    it('gives both members the same group, and a student who joins later sees it too', async () => {
      await match(courseId, ids[a], ids[b]);
      await match(courseId, ids[a], ids[c]);
      const [fromA, fromB, fromC] = await Promise.all([a, b, c].map((s) => getGroup(ids[s], course)));
      expect(fromB!.groupId).toBe(fromA!.groupId);
      expect(fromC!.groupId).toBe(fromA!.groupId);
      expect(fromC!.members).toHaveLength(3);
    });

    it('marks who the caller already reviewed, and only for the caller', async () => {
      await match(courseId, ids[a], ids[b]);
      const group = (await getGroup(ids[a], course))!;
      await submitReview(ids[a], group.groupId, {
        revieweeId: ids[b].toString(),
        ratings: REVIEW_CRITERIA.map((criteriaName) => ({ criteriaName, rating: 4 })),
      });

      const mine = await getGroup(ids[a], course);
      expect(mine!.members.find((m) => m.studentId === ids[b].toString())!.reviewedByMe).toBe(true);
      // b hasn't reviewed anyone
      const theirs = await getGroup(ids[b], course);
      expect(theirs!.members.every((m) => !m.reviewedByMe)).toBe(true);
    });

    it('only looks at the course asked for', async () => {
      await match(courseId, ids[a], ids[b]);
      expect(await getGroup(ids[a], '999999999')).toBeNull();
      await expect(getGroup(ids[a], 'abc')).rejects.toThrow(ValidationError);
    });
  });

  describe('getMatchedProfile', () => {
    it('gives the full profile, with the contact email, after an accepted request', async () => {
      await match(courseId, ids[a], ids[b]);
      const profile = await getMatchedProfile(ids[a], course, ids[b].toString());

      expect(profile).toMatchObject({
        studentId: ids[b].toString(),
        courseId: course,
        name: expect.stringContaining('Student'),
        schoolEmail: expect.stringMatching(/@test\.edu$/),
        gradeGoal: 'A_TRACK',
        workStyle: 'SOLO',
        reviewAverage: null,
      });
      // the whole availability, not just the part that overlaps
      expect(profile.blocks).toEqual([
        { weekday: 1, startMinute: 540, endMinute: 600 },
        { weekday: 3, startMinute: 780, endMinute: 900 },
      ]);
    });

    it('works from either side of the request', async () => {
      await match(courseId, ids[a], ids[b]);
      expect((await getMatchedProfile(ids[b], course, ids[a].toString())).studentId).toBe(ids[a].toString());
    });

    it('is forbidden while the request is still pending', async () => {
      await sendRequest(ids[a], course, ids[b].toString());
      await expect(getMatchedProfile(ids[a], course, ids[b].toString())).rejects.toThrow(ForbiddenError);
      await expect(getMatchedProfile(ids[b], course, ids[a].toString())).rejects.toThrow(ForbiddenError);
    });

    it('is forbidden after a decline or a cancel', async () => {
      const declined = await sendRequest(ids[a], course, ids[b].toString());
      await respond(ids[b], declined.requestId, 'DECLINE');
      const canceled = await sendRequest(ids[a], course, ids[c].toString());
      await cancel(ids[a], canceled.requestId);

      await expect(getMatchedProfile(ids[a], course, ids[b].toString())).rejects.toThrow(ForbiddenError);
      await expect(getMatchedProfile(ids[a], course, ids[c].toString())).rejects.toThrow(ForbiddenError);
    });

    it('is forbidden for a groupmate you were never matched with directly', async () => {
      await match(courseId, ids[a], ids[b]);
      await match(courseId, ids[a], ids[c]);
      // b and c are in the same group but have no accepted request between them
      await expect(getMatchedProfile(ids[b], course, ids[c].toString())).rejects.toThrow(ForbiddenError);
    });

    it('is forbidden for a stranger, and for an id that does not exist, with the same answer', async () => {
      await match(courseId, ids[a], ids[b]);
      await expect(getMatchedProfile(ids[a], course, ids[d].toString())).rejects.toThrow(ForbiddenError);
      await expect(getMatchedProfile(ids[a], course, '999999999')).rejects.toThrow(ForbiddenError);
    });

    it('does not carry over from another course', async () => {
      await match(courseId, ids[a], ids[b]);
      await expect(getMatchedProfile(ids[a], '999999999', ids[b].toString())).rejects.toThrow(ForbiddenError);
    });

    it('shows the average once they have been reviewed', async () => {
      await match(courseId, ids[a], ids[b]);
      const group = (await getGroup(ids[a], course))!;
      await submitReview(ids[a], group.groupId, {
        revieweeId: ids[b].toString(),
        ratings: [
          { criteriaName: 'Communication', rating: 5 },
          { criteriaName: 'Reliability', rating: 4 },
          { criteriaName: 'Contribution', rating: 3 },
        ],
      });
      expect((await getMatchedProfile(ids[a], course, ids[b].toString())).reviewAverage).toBe(4);
    });
  });
});
