import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { ForbiddenError, StateConflictError, ValidationError, toId } from '../errors';
import { lockEnrollments } from '../enrollment/lock';
import { findCandidates } from '../matching/findCandidates';
import { StateConflictError as NoProfileError } from '../matching/errors';
import { isEligible } from '../matching/pipeline';
import { toProfile } from '../matching/postgresData';
import { RequestRecord } from './types';

// match requests (sdd 3.3, 5.3, 6.3.5 to 6.3.8). studentId is always the signed in
// student from the session. every change locks the students' enrollment rows,
// lower id first, so two requests touching the same pair can't get tangled.

const withBlocks = { blocks: true } as const;

function toRecord(row: Prisma.MatchRequestGetPayload<object>): RequestRecord {
  return {
    requestId: row.id.toString(),
    courseId: row.courseId.toString(),
    requesterId: row.requesterId.toString(),
    recipientId: row.recipientId.toString(),
    status: row.status,
    requestedAt: row.requestedAt.toISOString(),
    respondedAt: row.respondedAt ? row.respondedAt.toISOString() : null,
  };
}

// the partial unique index is the last guard against two pending requests, and a
// unique membership is the last guard against two groups. a race that gets past
// the checks lands here as a P2002.
function isUniqueViolation(err: unknown) {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

export async function sendRequest(studentId: bigint, courseIdRaw: string, recipientIdRaw: string) {
  const courseId = toId(courseIdRaw, 'courseId');
  const recipientId = toId(recipientIdRaw, 'recipientId');
  if (recipientId === studentId) throw new ValidationError(['recipientId']);

  const [first, second] = studentId < recipientId ? [studentId, recipientId] : [recipientId, studentId];

  try {
    return await prisma.$transaction(async (tx) => {
      if (!(await lockEnrollments(tx, courseId, first, second))) throw new StateConflictError('NOT_ENROLLED');

      // both profiles are read inside the lock, so a profile save can't change
      // them between the check and the insert
      const rows = await tx.profile.findMany({
        where: { courseId, studentId: { in: [studentId, recipientId] }, blocks: { some: {} } },
        include: withBlocks,
      });
      const mine = rows.find((r) => r.studentId === studentId);
      const theirs = rows.find((r) => r.studentId === recipientId);
      if (!mine) throw new StateConflictError('NO_PROFILE');
      if (!theirs || !isEligible(toProfile(mine), toProfile(theirs))) throw new StateConflictError('NO_LONGER_ELIGIBLE');

      const duplicate = await tx.matchRequest.findFirst({
        where: { requesterId: studentId, recipientId, courseId, status: 'PENDING' },
      });
      if (duplicate) throw new StateConflictError('DUPLICATE_REQUEST');

      const created = await tx.matchRequest.create({ data: { requesterId: studentId, recipientId, courseId } });
      return toRecord(created);
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw new StateConflictError('DUPLICATE_REQUEST');
    throw err;
  }
}

// the student's sent and received requests in a course, newest first. a canceled
// request stays in the sender's history but is gone from the recipient's list.
// each one carries the other student's limited summary so the screen has
// something to show before a match.
export async function listRequests(studentId: bigint, courseIdRaw: string): Promise<RequestRecord[]> {
  const courseId = toId(courseIdRaw, 'courseId');

  // every course-scoped route checks the roster first (test plan 4.3, RESP-5)
  const enrolled = await prisma.enrollment.findFirst({ where: { studentId, courseId }, select: { studentId: true } });
  if (!enrolled) throw new StateConflictError('NOT_ENROLLED');

  const rows = await prisma.matchRequest.findMany({
    where: {
      courseId,
      OR: [{ requesterId: studentId }, { recipientId: studentId, status: { not: 'CANCELED' } }],
    },
    orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
  });
  if (rows.length === 0) return [];

  // the summaries come from the matching code, so they follow the same limited view
  const summaries = new Map<string, NonNullable<RequestRecord['other']>>();
  try {
    const candidates = await findCandidates(studentId.toString(), courseId.toString());
    candidates.forEach((c) => summaries.set(c.candidateId, c));
  } catch (err) {
    // no profile of your own means no summaries, the requests still show
    if (!(err instanceof NoProfileError)) throw err;
  }

  return rows.map((row) => {
    const record = toRecord(row);
    const otherId = row.requesterId === studentId ? record.recipientId : record.requesterId;
    return { ...record, other: summaries.get(otherId) ?? null };
  });
}

// reads the request and checks it's yours to answer. a request that doesn't
// exist and one that isn't yours get the same answer, so ids can't be probed.
async function findRequest(requestIdRaw: string) {
  const requestId = toId(requestIdRaw, 'requestId');
  const row = await prisma.matchRequest.findUnique({ where: { id: requestId } });
  if (!row) throw new ForbiddenError();
  return row;
}

// locks the request row and makes sure nobody answered it first
async function lockPending(tx: Prisma.TransactionClient, requestId: bigint) {
  const rows = await tx.$queryRaw<{ status: string }[]>`
    SELECT status::text AS status FROM match_request WHERE id = ${requestId} FOR UPDATE`;
  if (rows.length === 0 || rows[0].status !== 'PENDING') throw new StateConflictError('NOT_PENDING');
}

export async function respond(studentId: bigint, requestIdRaw: string, decision: 'ACCEPT' | 'DECLINE') {
  const found = await findRequest(requestIdRaw);
  // the first read only finds the course and the two students, it authorizes nothing
  if (found.recipientId !== studentId) throw new ForbiddenError();

  if (decision === 'DECLINE') {
    return prisma.$transaction(async (tx) => {
      await lockPending(tx, found.id);
      const updated = await tx.matchRequest.update({
        where: { id: found.id },
        data: { status: 'DECLINED', respondedAt: new Date() },
      });
      return toRecord(updated);
    });
  }

  const { courseId, requesterId, recipientId } = found;
  const [first, second] = requesterId < recipientId ? [requesterId, recipientId] : [recipientId, requesterId];

  try {
    return await prisma.$transaction(async (tx) => {
      // enrollment rows first, then the request, always in that order
      if (!(await lockEnrollments(tx, courseId, first, second))) throw new StateConflictError('NOT_ENROLLED');
      await lockPending(tx, found.id);

      const profiles = await tx.profile.count({
        where: { courseId, studentId: { in: [requesterId, recipientId] }, blocks: { some: {} } },
      });
      if (profiles < 2) throw new StateConflictError('NO_LONGER_ELIGIBLE');

      const memberships = await tx.groupMembership.findMany({
        where: { courseId, studentId: { in: [requesterId, recipientId] } },
      });
      if (memberships.length === 2) throw new StateConflictError('GROUP_MERGE');

      if (memberships.length === 1) {
        // one of them has a group, so the other joins it (Group.AddMember)
        const joiner = memberships[0].studentId === requesterId ? recipientId : requesterId;
        await tx.groupMembership.create({ data: { groupId: memberships[0].groupId, studentId: joiner, courseId } });
      } else {
        // neither has one, so they start a new one (Group.Create)
        const group = await tx.studyGroup.create({ data: { courseId } });
        await tx.groupMembership.createMany({
          data: [requesterId, recipientId].map((id) => ({ groupId: group.id, studentId: id, courseId })),
        });
      }

      const updated = await tx.matchRequest.update({
        where: { id: found.id },
        data: { status: 'ACCEPTED', respondedAt: new Date() },
      });
      return toRecord(updated);
    });
  } catch (err) {
    // two accepts at once ended up wanting a second group for the same student
    if (isUniqueViolation(err)) throw new StateConflictError('GROUP_MERGE');
    throw err;
  }
}

export async function cancel(studentId: bigint, requestIdRaw: string) {
  const found = await findRequest(requestIdRaw);
  if (found.requesterId !== studentId) throw new ForbiddenError();

  return prisma.$transaction(async (tx) => {
    await lockPending(tx, found.id);
    const updated = await tx.matchRequest.update({
      where: { id: found.id },
      data: { status: 'CANCELED', respondedAt: new Date() },
    });
    return toRecord(updated);
  });
}
