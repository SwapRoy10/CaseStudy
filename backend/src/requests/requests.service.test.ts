import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { config } from '../config';
import { prisma } from '../db';
import { ForbiddenError, StateConflictError, ValidationError } from '../errors';
import * as matching from '../matching/findCandidates';
import { cancel, listRequests, respond, sendRequest } from './requests.service';
import { makeClass } from './testUtils';

// match requests against a real database. each describe makes its own small class.
// 0 and 1 are a good pair, 2 is pass track, 3 is free at another time, 4 has no profile.

const tag = `rq${Date.now()}`;

describe.skipIf(config.useMockData)('match requests', () => {
  let course: string;
  let ids: bigint[];
  let cleanup: () => Promise<void>;
  const [a, b, c, d, e] = [0, 1, 2, 3, 4];

  beforeAll(async () => {
    const made = await makeClass(tag, [
      {},
      { style: 'SOLO' },
      { goal: 'PASS_TRACK' },
      { blocks: [[3, 14, 16]] },
      { blocks: null },
      {},
    ]);
    course = made.courseId.toString();
    ids = made.ids;
    cleanup = made.cleanup;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const send = (from: number, to: number) => sendRequest(ids[from], course, ids[to].toString());

  it('reports a duplicate request when the database rejects a competing insert', async () => {
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate request', { code: 'P2002', clientVersion: Prisma.prismaVersion.client }),
    );
    try {
      await expect(send(a, b)).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
    } finally {
      transaction.mockRestore();
    }
  });

  it('reports a group conflict when the database rejects a competing accept', async () => {
    const pending = await send(a, b);
    const transaction = vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('duplicate membership', { code: 'P2002', clientVersion: Prisma.prismaVersion.client }),
    );
    try {
      await expect(respond(ids[b], pending.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'GROUP_MERGE' });
    } finally {
      transaction.mockRestore();
      await cancel(ids[a], pending.requestId);
    }
  });

  it('propagates an unexpected matching error while listing requests', async () => {
    const pending = await send(a, b);
    const failure = new Error('matching failed');
    const candidates = vi.spyOn(matching, 'findCandidates').mockRejectedValueOnce(failure);
    try {
      await expect(listRequests(ids[a], course)).rejects.toBe(failure);
    } finally {
      candidates.mockRestore();
      await cancel(ids[a], pending.requestId);
    }
  });

  describe('sendRequest', () => {
    it('saves a pending request from the signed in student', async () => {
      const record = await send(a, b);
      expect(record).toMatchObject({
        courseId: course,
        requesterId: ids[a].toString(),
        recipientId: ids[b].toString(),
        status: 'PENDING',
        respondedAt: null,
      });
      expect(new Date(record.requestedAt).toString()).not.toBe('Invalid Date');
      await cancel(ids[a], record.requestId);
    });

    it('refuses a request to yourself with VALIDATION and writes nothing', async () => {
      await expect(send(a, a)).rejects.toThrow(ValidationError);
      expect(await prisma.matchRequest.count({ where: { requesterId: ids[a], recipientId: ids[a] } })).toBe(0);
    });

    it('refuses a recipient who is not on the roster', async () => {
      const outsider = await prisma.student.create({
        data: { name: 'Outside', schoolEmail: `${tag}-out@test.edu`, passwordHash: 'x' },
      });
      try {
        await expect(sendRequest(ids[a], course, outsider.id.toString())).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
        await expect(sendRequest(outsider.id, course, ids[a].toString())).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
      } finally {
        await prisma.student.delete({ where: { id: outsider.id } });
      }
    });

    it('refuses when the sender has no profile', async () => {
      await expect(send(e, a)).rejects.toMatchObject({ code: 'NO_PROFILE' });
    });

    it('refuses a recipient who has no profile, a different grade goal, or no shared time', async () => {
      await expect(send(a, e)).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
      await expect(send(a, c)).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
      await expect(send(a, d)).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
    });

    it('refuses a second pending request to the same student', async () => {
      const first = await send(a, b);
      await expect(send(a, b)).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
      expect(await prisma.matchRequest.count({ where: { requesterId: ids[a], recipientId: ids[b], status: 'PENDING' } })).toBe(1);
      await cancel(ids[a], first.requestId);
    });

    it('lets you ask again once the first one is canceled or answered', async () => {
      const first = await send(a, b);
      await cancel(ids[a], first.requestId);
      const second = await send(a, b);
      await respond(ids[b], second.requestId, 'DECLINE');
      const third = await send(a, b);
      expect(third.status).toBe('PENDING');
      await cancel(ids[a], third.requestId);
    });

    it('lets only one of two requests sent at the same moment through', async () => {
      const results = await Promise.allSettled([send(a, b), send(a, b)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(failed.reason).toBeInstanceOf(StateConflictError);
      expect(failed.reason.code).toBe('DUPLICATE_REQUEST');
      const pending = await prisma.matchRequest.findFirstOrThrow({
        where: { requesterId: ids[a], recipientId: ids[b], status: 'PENDING' },
      });
      await cancel(ids[a], pending.id.toString());
    });

    it('rechecks eligibility with the profiles as they are now', async () => {
      // b stops matching a by changing grade goal, then goes back
      await prisma.profile.update({ where: { studentId_courseId: { studentId: ids[b], courseId: BigInt(course) } }, data: { gradeGoal: 'PASS_TRACK' } });
      try {
        await expect(send(a, b)).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
      } finally {
        await prisma.profile.update({ where: { studentId_courseId: { studentId: ids[b], courseId: BigInt(course) } }, data: { gradeGoal: 'A_TRACK' } });
      }
    });
  });

  describe('listRequests', () => {
    it('shows sent and received requests, newest first, with a limited summary of the other student', async () => {
      const older = await send(a, b);
      const newer = await send(5, a);
      try {
        const mine = await listRequests(ids[a], course);
        // the canceled ones from the other tests are still in a's history, further down
        expect(mine.slice(0, 2).map((r) => r.requestId)).toEqual([newer.requestId, older.requestId]);

        const sent = mine.find((r) => r.requestId === older.requestId)!;
        // from a's side the other student is b: same grade goal, group vs solo, one shared block
        expect(sent.other).toEqual({
          candidateId: ids[b].toString(),
          gradeGoal: 'A_TRACK',
          workStyle: 'SOLO',
          sharedIntervals: [{ weekday: 1, startMinute: 540, endMinute: 660 }],
          reviewAverage: null,
        });
        // no names or emails before a match
        expect(JSON.stringify(mine)).not.toMatch(/Student |@test\.edu/);
      } finally {
        await cancel(ids[a], older.requestId);
        await cancel(ids[5], newer.requestId);
      }
    });

    it('keeps a canceled request in the sender list but not the recipient list', async () => {
      const sent = await send(a, b);
      await cancel(ids[a], sent.requestId);

      const senderSees = await listRequests(ids[a], course);
      expect(senderSees.find((r) => r.requestId === sent.requestId)?.status).toBe('CANCELED');
      const recipientSees = await listRequests(ids[b], course);
      expect(recipientSees.find((r) => r.requestId === sent.requestId)).toBeUndefined();
    });

    it('only shows your own requests', async () => {
      const sent = await send(a, b);
      try {
        expect((await listRequests(ids[d], course)).find((r) => r.requestId === sent.requestId)).toBeUndefined();
      } finally {
        await cancel(ids[a], sent.requestId);
      }
    });

    it('gives other: null when the other student no longer matches', async () => {
      const sent = await send(a, b);
      await prisma.profile.update({ where: { studentId_courseId: { studentId: ids[b], courseId: BigInt(course) } }, data: { gradeGoal: 'PASS_TRACK' } });
      try {
        const list = await listRequests(ids[a], course);
        expect(list.find((r) => r.requestId === sent.requestId)?.other).toBeNull();
      } finally {
        await prisma.profile.update({ where: { studentId_courseId: { studentId: ids[b], courseId: BigInt(course) } }, data: { gradeGoal: 'A_TRACK' } });
        await cancel(ids[a], sent.requestId);
      }
    });

    it('still lists requests when the caller has no profile of their own', async () => {
      const got = await send(a, b);
      try {
        // b loses their profile
        await prisma.profile.deleteMany({ where: { studentId: ids[b], courseId: BigInt(course) } });
        const list = await listRequests(ids[b], course);
        expect(list.find((r) => r.requestId === got.requestId)).toMatchObject({ status: 'PENDING', other: null });
      } finally {
        await cancel(ids[a], got.requestId);
        await prisma.profile.create({
          data: {
            studentId: ids[b],
            courseId: BigInt(course),
            gradeGoal: 'A_TRACK',
            workStyle: 'SOLO',
            blocks: { create: [{ weekday: 1, startMinute: 540, endMinute: 660 }] },
          },
        });
      }
    });

    it('is empty for a course with no requests', async () => {
            expect(await listRequests(ids[d], course)).toEqual([]);
    });

    it('refuses a course the student is not on (RESP-5)', async () => {
      await expect(listRequests(ids[d], '999999999')).rejects.toThrow('NOT_ENROLLED');
    });
  });
});
