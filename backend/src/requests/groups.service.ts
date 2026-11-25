import { prisma } from '../db';
import { ForbiddenError, StateConflictError, toId } from '../errors';
import { toOwnProfile } from '../profile/ownProfile';
import { getOwnProfile } from '../profile/profile.service';
import { REVIEW_CRITERIA } from '../reviews/criteria';
import { GroupView } from './types';

// the student's group in a course (sdd 6.3.9), null if none
export async function getGroup(studentId: bigint, courseIdRaw: string): Promise<GroupView | null> {
  const courseId = toId(courseIdRaw, 'courseId');

  // roster check first (test plan 4.3, GRP-5)
  const enrolled = await prisma.enrollment.findFirst({ where: { studentId, courseId }, select: { studentId: true } });
  if (!enrolled) throw new StateConflictError('NOT_ENROLLED');

  const membership = await prisma.groupMembership.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      group: { include: { members: { include: { student: { select: { name: true } } }, orderBy: { studentId: 'asc' } } } },
    },
  });
  if (!membership) return null; // not in a group

  const reviewed = await prisma.peerReview.findMany({
    where: { reviewerId: studentId, groupId: membership.groupId },
    select: { revieweeId: true },
  });
  const reviewedIds = new Set(reviewed.map((r) => r.revieweeId));

  return {
    groupId: membership.groupId.toString(),
    courseId: courseId.toString(),
    formedAt: membership.group.formedAt.toISOString(),
    members: membership.group.members.map((m) => ({
      studentId: m.studentId.toString(),
      name: m.student.name,
      reviewedByMe: reviewedIds.has(m.studentId),
    })),
    criteria: REVIEW_CRITERIA,
  };
}

// full profile of an accepted match (sdd 6.3.10, PR-2), 403 for anyone else
export async function getMatchedProfile(studentId: bigint, courseIdRaw: string, otherIdRaw: string) {
  const courseId = toId(courseIdRaw, 'courseId');
  const otherId = toId(otherIdRaw, 'studentId');

  const accepted = await prisma.matchRequest.findFirst({
    where: {
      courseId,
      status: 'ACCEPTED',
      OR: [
        { requesterId: studentId, recipientId: otherId },
        { requesterId: otherId, recipientId: studentId },
      ],
    },
    select: { id: true },
  });
  if (!accepted) throw new ForbiddenError(); // not matched

  const profile = toOwnProfile(await getOwnProfile(otherId, courseId));
  if (!profile) throw new ForbiddenError();
  return { studentId: otherId.toString(), ...profile };
}
