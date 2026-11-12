import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { Id, Profile } from './types';

// postgres reads for matching (sdd 5.4). ids are bigint in the database but
// strings everywhere else, so they get converted here and nowhere else.

const withBlocks = { blocks: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } } satisfies Prisma.ProfileInclude;

type ProfileRow = Prisma.ProfileGetPayload<{ include: typeof withBlocks }>;

// exported so the match request code can turn rows it reads inside its own
// transaction into the same profile shape and call isEligible on them
export function toProfile(row: ProfileRow): Profile {
  return {
    profileId: row.id.toString(),
    studentId: row.studentId.toString(),
    courseId: row.courseId.toString(),
    gradeGoal: row.gradeGoal,
    workStyle: row.workStyle,
    blocks: row.blocks.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })),
  };
}

export async function isEnrolled(studentId: Id, courseId: Id): Promise<boolean> {
  const row = await prisma.enrollment.findUnique({
    where: { studentId_courseId: { studentId: BigInt(studentId), courseId: BigInt(courseId) } },
    select: { studentId: true },
  });
  return row !== null;
}

// a profile only exists for an enrolled student, so the roster check is built in.
// blocks come back in the same query, not one read per student (sdd 5.4).
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  const rows = await prisma.profile.findMany({
    where: { courseId: BigInt(courseId), blocks: { some: {} } },
    include: withBlocks,
  });
  return rows.map(toProfile);
}

// average over every rating a student has received, the same figure the profile
// page shows. students with no reviews are left out of the map.
export async function getAverages(studentIds: Id[]): Promise<Map<Id, number>> {
  if (studentIds.length === 0) return new Map();

  const rows = await prisma.$queryRaw<{ studentId: bigint; average: number }[]>`
    SELECT pr.reviewee_id AS "studentId", AVG(rc.rating)::float8 AS average
    FROM rating_criterion rc
    JOIN peer_review pr ON pr.id = rc.review_id
    WHERE pr.reviewee_id = ANY(${studentIds.map(BigInt)}::bigint[])
    GROUP BY pr.reviewee_id`;
  return new Map(rows.map((r) => [r.studentId.toString(), r.average]));
}
