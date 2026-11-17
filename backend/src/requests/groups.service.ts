import { prisma } from '../db';
import { ForbiddenError, toId } from '../errors';
import { getOwnProfile } from '../profile/profile.service';
import { REVIEW_CRITERIA } from '../reviews/criteria';
import { GroupView } from './types';

// the student's confirmed group in a course (sdd 6.3.9), or null if they're not in one.
// it lists who is in it, which of them the student has already reviewed, and the
// criteria the review form needs.
export async function getGroup(studentId: bigint, courseIdRaw: string): Promise<GroupView | null> {
  const courseId = toId(courseIdRaw, 'courseId');

  const membership = await prisma.groupMembership.findUnique({
    where: { studentId_courseId: { studentId, courseId } },
    include: {
      group: { include: { members: { include: { student: { select: { name: true } } }, orderBy: { studentId: 'asc' } } } },
    },
  });
  if (!membership) return null;

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

// someone's full profile, but only if you have an accepted request with them in
// this course (sdd 6.3.10, PR-2). the check runs on every call, and an id you
// aren't matched with gets a 403 whether or not that student exists.
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
  if (!accepted) throw new ForbiddenError();

  return { studentId: otherId.toString(), ...(await getOwnProfile(otherId, courseId)) };
}
