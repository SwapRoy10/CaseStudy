// collaborative code by the group and claude sonnet 5.5

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { config } from '../config';
import { prisma } from '../db';
import { ForbiddenError, StateConflictError, ValidationError } from '../errors';
import { cancel, respond, sendRequest } from './requests.service';
import { makeClass, match } from './testUtils';

// answer and cancel requests, and groups from accepting, 6 fresh students

describe.skipIf(config.useMockData)('answering requests', () => {
  let courseId: bigint;
  let course: string;
  let ids: bigint[];
  let cleanup: () => Promise<void>;
  const [a, b, c, d, e] = [0, 1, 2, 3, 4];

  beforeEach(async () => {
    const made = await makeClass(`rs${Date.now()}${Math.floor(Math.random() * 1000)}`, Array.from({ length: 6 }, () => ({})));
    courseId = made.courseId;
    course = courseId.toString();
    ids = made.ids;
    cleanup = made.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  const send = (from: number, to: number) => sendRequest(ids[from], course, ids[to].toString());
  const groupsOf = (student: number) => prisma.groupMembership.findMany({ where: { studentId: ids[student], courseId } });
  const memberCount = (groupId: bigint) => prisma.groupMembership.count({ where: { groupId } });

  describe('accepting', () => {
    it('makes a new group of the two when neither is in one', async () => {
      const sent = await send(a, b);
      const answered = await respond(ids[b], sent.requestId, 'ACCEPT');

      expect(answered.status).toBe('ACCEPTED');
      expect(answered.respondedAt).not.toBeNull();
      const [mine] = await groupsOf(a);
      const [theirs] = await groupsOf(b);
      expect(mine.groupId).toBe(theirs.groupId);
      expect(await memberCount(mine.groupId)).toBe(2);
      expect((await prisma.studyGroup.findUniqueOrThrow({ where: { id: mine.groupId } })).courseId).toBe(courseId);
    });

    it('adds the new student to the requester group', async () => {
      await match(courseId, ids[a], ids[b]);
      const [group] = await groupsOf(a);

      // a is in a group, c is not, and c accepts a's request
      const sent = await send(a, c);
      await respond(ids[c], sent.requestId, 'ACCEPT');

      expect((await groupsOf(c))[0].groupId).toBe(group.groupId);
      expect(await memberCount(group.groupId)).toBe(3);
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(1);
    });

    it('adds the requester to the recipient group', async () => {
      await match(courseId, ids[a], ids[b]);
      const [group] = await groupsOf(a);

      // c has no group and asks a, who is in one
      const sent = await send(c, a);
      await respond(ids[a], sent.requestId, 'ACCEPT');

      expect((await groupsOf(c))[0].groupId).toBe(group.groupId);
      expect(await memberCount(group.groupId)).toBe(3);
    });

    it('will not merge two groups, says so, and leaves the request pending', async () => {
      await match(courseId, ids[a], ids[b]);
      await match(courseId, ids[c], ids[d]);

      const sent = await send(a, c);
      await expect(respond(ids[c], sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'GROUP_MERGE' });

      expect((await prisma.matchRequest.findUniqueOrThrow({ where: { id: BigInt(sent.requestId) } })).status).toBe('PENDING');
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(2);
      expect(await prisma.groupMembership.count({ where: { courseId } })).toBe(4);
    });

    it('will not accept a request between two people who are already in the same group', async () => {
      await match(courseId, ids[a], ids[b]);
      await match(courseId, ids[a], ids[c]);

      // b and c are both in a's group, they have no accepted request with each other
      const sent = await send(b, c);
      await expect(respond(ids[c], sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'GROUP_MERGE' });
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(1);
    });

    it('needs both students to still have a complete profile', async () => {
      const sent = await send(a, b);
      await prisma.profile.deleteMany({ where: { studentId: ids[a], courseId } });

      await expect(respond(ids[b], sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(0);
      expect((await prisma.matchRequest.findUniqueOrThrow({ where: { id: BigInt(sent.requestId) } })).status).toBe('PENDING');
    });

    it('needs both students to still be on the roster', async () => {
      const sent = await send(a, b);
      await prisma.profile.deleteMany({ where: { studentId: ids[a], courseId } });
      await prisma.enrollment.delete({ where: { studentId_courseId: { studentId: ids[a], courseId } } });

      await expect(respond(ids[b], sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(0);
    });

    it('lets a second request through to the same student, who by then has a group', async () => {
      // a asks b and c asks b. b says yes to both, at the same moment
      const first = await send(a, b);
      const second = await send(c, b);
      const results = await Promise.all([
        respond(ids[b], first.requestId, 'ACCEPT'),
        respond(ids[b], second.requestId, 'ACCEPT'),
      ]);

      expect(results.map((r) => r.status)).toEqual(['ACCEPTED', 'ACCEPTED']);
      // one group with all three, not two groups sharing b
      const groups = await prisma.studyGroup.findMany({ where: { courseId }, include: { members: true } });
      expect(groups).toHaveLength(1);
      expect(groups[0].members.map((m) => m.studentId).sort()).toEqual([ids[a], ids[b], ids[c]].sort());
    });

    it('answers the same request twice at once with one accept and one NOT_PENDING', async () => {
      const sent = await send(a, b);
      const results = await Promise.allSettled([
        respond(ids[b], sent.requestId, 'ACCEPT'),
        respond(ids[b], sent.requestId, 'ACCEPT'),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failed.reason).toBeInstanceOf(StateConflictError);
      expect(failed.reason.code).toBe('NOT_PENDING');
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(1);
    });

    it('makes two separate groups when two unrelated pairs accept at once', async () => {
      const first = await send(a, b);
      const second = await send(c, d);
      await Promise.all([respond(ids[b], first.requestId, 'ACCEPT'), respond(ids[d], second.requestId, 'ACCEPT')]);
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(2);
    });

    it('lets two requests that cross over each other both end up in one group', async () => {
      // a asks b and b asks c, answered at the same moment. b is in both
      const first = await send(a, b);
      const second = await send(b, c);
      await Promise.all([respond(ids[b], first.requestId, 'ACCEPT'), respond(ids[c], second.requestId, 'ACCEPT')]);
      const groups = await prisma.studyGroup.findMany({ where: { courseId }, include: { members: true } });
      expect(groups).toHaveLength(1);
      expect(groups[0].members).toHaveLength(3);
    });
  });

  describe('declining', () => {
    it('records DECLINED with a time and makes no group', async () => {
      const sent = await send(a, b);
      const answered = await respond(ids[b], sent.requestId, 'DECLINE');

      expect(answered.status).toBe('DECLINED');
      expect(answered.respondedAt).not.toBeNull();
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(0);
    });

    it('can not be accepted afterwards', async () => {
      const sent = await send(a, b);
      await respond(ids[b], sent.requestId, 'DECLINE');
      await expect(respond(ids[b], sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_PENDING' });
    });

    it('does not need a roster or profile check, so it works even if the sender left', async () => {
      const sent = await send(a, b);
      await prisma.profile.deleteMany({ where: { studentId: ids[a], courseId } });
      const answered = await respond(ids[b], sent.requestId, 'DECLINE');
      expect(answered.status).toBe('DECLINED');
    });
  });

  describe('who is allowed to answer', () => {
    it('only the recipient, not the sender and not anyone else', async () => {
      const sent = await send(a, b);
      await expect(respond(ids[a], sent.requestId, 'ACCEPT')).rejects.toThrow(ForbiddenError);
      await expect(respond(ids[c], sent.requestId, 'ACCEPT')).rejects.toThrow(ForbiddenError);
      await expect(respond(ids[c], sent.requestId, 'DECLINE')).rejects.toThrow(ForbiddenError);
      expect((await prisma.matchRequest.findUniqueOrThrow({ where: { id: BigInt(sent.requestId) } })).status).toBe('PENDING');
    });

    it('gives a request that does not exist the same answer as one that is not yours', async () => {
      await expect(respond(ids[a], '999999999', 'ACCEPT')).rejects.toThrow(ForbiddenError);
    });

    it('rejects an id that is not a number', async () => {
      await expect(respond(ids[a], 'abc', 'ACCEPT')).rejects.toThrow(ValidationError);
    });
  });

  describe('canceling', () => {
    it('lets the sender withdraw a pending request', async () => {
      const sent = await send(a, b);
      const canceled = await cancel(ids[a], sent.requestId);
      expect(canceled.status).toBe('CANCELED');
      expect(canceled.respondedAt).not.toBeNull();
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(0);
    });

    it('then the recipient can not accept it', async () => {
      const sent = await send(a, b);
      await cancel(ids[a], sent.requestId);
      await expect(respond(ids[b], sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_PENDING' });
    });

    it('only the sender can cancel', async () => {
      const sent = await send(a, b);
      await expect(cancel(ids[b], sent.requestId)).rejects.toThrow(ForbiddenError);
      await expect(cancel(ids[c], sent.requestId)).rejects.toThrow(ForbiddenError);
      await expect(cancel(ids[a], '999999999')).rejects.toThrow(ForbiddenError);
    });

    it('only while it is still pending', async () => {
      const accepted = await send(a, b);
      await respond(ids[b], accepted.requestId, 'ACCEPT');
      await expect(cancel(ids[a], accepted.requestId)).rejects.toMatchObject({ code: 'NOT_PENDING' });

      const declined = await send(a, c);
      await respond(ids[c], declined.requestId, 'DECLINE');
      await expect(cancel(ids[a], declined.requestId)).rejects.toMatchObject({ code: 'NOT_PENDING' });

      const canceled = await send(a, d);
      await cancel(ids[a], canceled.requestId);
      await expect(cancel(ids[a], canceled.requestId)).rejects.toMatchObject({ code: 'NOT_PENDING' });
    });

    it('answers a cancel and an accept at the same moment with one winner', async () => {
      const sent = await send(a, b);
      const results = await Promise.allSettled([cancel(ids[a], sent.requestId), respond(ids[b], sent.requestId, 'ACCEPT')]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

      const row = await prisma.matchRequest.findUniqueOrThrow({ where: { id: BigInt(sent.requestId) } });
      // a group exists only if the accept won
      expect(await prisma.studyGroup.count({ where: { courseId } })).toBe(row.status === 'ACCEPTED' ? 1 : 0);
    });
  });
});
