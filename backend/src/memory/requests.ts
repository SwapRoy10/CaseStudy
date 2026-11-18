import { ForbiddenError, StateConflictError, ValidationError, toId } from '../errors';
import { isEligible, rankCandidates } from '../matching/pipeline';
import type { Profile } from '../matching/types';
import { RequestRecord } from '../requests/types';
import { averageFor, isEnrolled, store, StoredRequest } from './store';

// match requests on the in memory store, the same rules and the same errors as
// requests/requests.service.ts. the server handles one request at a time here, so
// there are no locks and nothing can happen between a check and the change.

function toRecord(r: StoredRequest): RequestRecord {
  return {
    requestId: String(r.id),
    courseId: r.courseId,
    requesterId: r.requesterId,
    recipientId: r.recipientId,
    status: r.status,
    requestedAt: r.requestedAt.toISOString(),
    respondedAt: r.respondedAt ? r.respondedAt.toISOString() : null,
  };
}

// a profile counts only with at least one free time
function completeProfile(studentId: string, courseId: string): Profile | undefined {
  return store.profiles.find((p) => p.studentId === studentId && p.courseId === courseId && p.blocks.length > 0);
}

// the limited summary of the other student from this student's side, the same
// fields as a candidate card. null if either has no complete profile or they no
// longer pass the matching filters.
function summaryOf(me: string, otherId: string, courseId: string): RequestRecord['other'] {
  const mine = completeProfile(me, courseId);
  const theirs = completeProfile(otherId, courseId);
  if (!mine || !theirs) return null;

  const [scored] = rankCandidates(mine, [theirs]);
  if (!scored) return null;
  return {
    candidateId: otherId,
    gradeGoal: scored.gradeGoal,
    workStyle: scored.workStyle,
    sharedIntervals: scored.sharedIntervals,
    reviewAverage: averageFor(otherId),
  };
}

export async function sendRequest(studentId: bigint, courseIdRaw: string, recipientIdRaw: string) {
  const courseId = toId(courseIdRaw, 'courseId').toString();
  const recipientId = toId(recipientIdRaw, 'recipientId').toString();
  const me = studentId.toString();
  if (!isEnrolled(me, courseId)) throw new StateConflictError('NOT_ENROLLED');
  if (recipientId === me) throw new ValidationError(['recipientId']);

  if (!isEnrolled(me, courseId) || !isEnrolled(recipientId, courseId)) throw new StateConflictError('NOT_ENROLLED');

  const mine = completeProfile(me, courseId);
  const theirs = completeProfile(recipientId, courseId);
  if (!mine) throw new StateConflictError('NO_PROFILE');
  if (!theirs || !isEligible(mine, theirs)) throw new StateConflictError('NO_LONGER_ELIGIBLE');

  const duplicate = store.requests.some(
    (r) => r.requesterId === me && r.recipientId === recipientId && r.courseId === courseId && r.status === 'PENDING'
  );
  if (duplicate) throw new StateConflictError('DUPLICATE_REQUEST');

  const created: StoredRequest = {
    id: store.nextRequestId++,
    courseId,
    requesterId: me,
    recipientId,
    status: 'PENDING',
    requestedAt: new Date(),
    respondedAt: null,
  };
  store.requests.push(created);
  return toRecord(created);
}

export async function listRequests(studentId: bigint, courseIdRaw: string): Promise<RequestRecord[]> {
  const courseId = toId(courseIdRaw, 'courseId').toString();
  const me = studentId.toString();

  // a canceled request stays with the sender and leaves the recipient's list
  const mine = store.requests
    .filter((r) => r.courseId === courseId && (r.requesterId === me || (r.recipientId === me && r.status !== 'CANCELED')))
    .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime() || b.id - a.id);
  if (mine.length === 0) return [];

  return mine.map((r) => ({ ...toRecord(r), other: summaryOf(me, r.requesterId === me ? r.recipientId : r.requesterId, courseId) }));
}

// a request that doesn't exist and one that isn't yours get the same answer
function findRequest(requestIdRaw: string) {
  const id = toId(requestIdRaw, 'requestId');
  const found = store.requests.find((r) => BigInt(r.id) === id);
  if (!found) throw new ForbiddenError();
  return found;
}

export async function respond(studentId: bigint, requestIdRaw: string, decision: 'ACCEPT' | 'DECLINE') {
  const request = findRequest(requestIdRaw);
  if (request.recipientId !== studentId.toString()) throw new ForbiddenError();

  if (decision === 'DECLINE') {
    if (request.status !== 'PENDING') throw new StateConflictError('NOT_PENDING');
    request.status = 'DECLINED';
    request.respondedAt = new Date();
    return toRecord(request);
  }

  const { courseId, requesterId, recipientId } = request;
  if (!isEnrolled(requesterId, courseId) || !isEnrolled(recipientId, courseId)) throw new StateConflictError('NOT_ENROLLED');
  if (request.status !== 'PENDING') throw new StateConflictError('NOT_PENDING');
  if (!completeProfile(requesterId, courseId) || !completeProfile(recipientId, courseId)) {
    throw new StateConflictError('NO_LONGER_ELIGIBLE');
  }

  const memberships = store.memberships.filter(
    (m) => m.courseId === courseId && (m.studentId === requesterId || m.studentId === recipientId)
  );
  if (memberships.length === 2) throw new StateConflictError('GROUP_MERGE');

  if (memberships.length === 1) {
    // one of them has a group, so the other joins it
    const joiner = memberships[0].studentId === requesterId ? recipientId : requesterId;
    store.memberships.push({ groupId: memberships[0].groupId, studentId: joiner, courseId });
  } else {
    const groupId = String(store.nextGroupId++);
    store.groups.push({ id: groupId, courseId, formedAt: new Date() });
    store.memberships.push({ groupId, studentId: requesterId, courseId }, { groupId, studentId: recipientId, courseId });
  }

  request.status = 'ACCEPTED';
  request.respondedAt = new Date();
  return toRecord(request);
}

export async function cancel(studentId: bigint, requestIdRaw: string) {
  const request = findRequest(requestIdRaw);
  if (request.requesterId !== studentId.toString()) throw new ForbiddenError();
  if (request.status !== 'PENDING') throw new StateConflictError('NOT_PENDING');

  request.status = 'CANCELED';
  request.respondedAt = new Date();
  return toRecord(request);
}
