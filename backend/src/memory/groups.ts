import { ForbiddenError, toId } from '../errors';
import { toOwnProfile } from '../profile/ownProfile';
import { GroupView } from '../requests/types';
import { REVIEW_CRITERIA } from '../reviews/criteria';
import { students } from '../sampleData';
import { getOwnProfile } from './profiles';
import { store } from './store';

// the same two functions as requests/groups.service.ts, on the in memory store

export async function getGroup(studentId: bigint, courseIdRaw: string): Promise<GroupView | null> {
  const courseId = toId(courseIdRaw, 'courseId').toString();
  const me = studentId.toString();

  const membership = store.memberships.find((m) => m.studentId === me && m.courseId === courseId);
  if (!membership) return null;
  const group = store.groups.find((g) => g.id === membership.groupId)!;

  const reviewed = new Set(store.reviews.filter((r) => r.reviewerId === me && r.groupId === group.id).map((r) => r.revieweeId));
  const members = store.memberships
    .filter((m) => m.groupId === group.id)
    .sort((a, b) => Number(a.studentId) - Number(b.studentId))
    .map((m) => ({
      studentId: m.studentId,
      name: students.find((s) => s.id === m.studentId)?.name ?? 'Unknown',
      reviewedByMe: reviewed.has(m.studentId),
    }));

  return { groupId: group.id, courseId, formedAt: group.formedAt.toISOString(), members, criteria: REVIEW_CRITERIA };
}

export async function getMatchedProfile(studentId: bigint, courseIdRaw: string, otherIdRaw: string) {
  const courseId = toId(courseIdRaw, 'courseId').toString();
  const otherId = toId(otherIdRaw, 'studentId').toString();
  const me = studentId.toString();

  const accepted = store.requests.some(
    (r) =>
      r.courseId === courseId &&
      r.status === 'ACCEPTED' &&
      ((r.requesterId === me && r.recipientId === otherId) || (r.requesterId === otherId && r.recipientId === me))
  );
  if (!accepted) throw new ForbiddenError();

  const profile = toOwnProfile(await getOwnProfile(BigInt(otherId), courseId));
  if (!profile) throw new ForbiddenError();
  return { studentId: otherId, ...profile };
}
