import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { Id, Profile } from './types';

// Postgres reads for matching (SDD 5.4). Ids are bigint in the database but
// strings everywhere else, so they get converted here and nowhere else.

const withBlocks = { blocks: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } } satisfies Prisma.ProfileInclude;

type ProfileRow = Prisma.ProfileGetPayload<{ include: typeof withBlocks }>;

function toProfile(row: ProfileRow): Profile {
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

export async function getProfile(studentId: Id, courseId: Id): Promise<Profile | null> {
  const row = await prisma.profile.findUnique({
    where: { studentId_courseId: { studentId: BigInt(studentId), courseId: BigInt(courseId) } },
    include: withBlocks,
  });
  return row && toProfile(row);
}

// A profile only exists for an enrolled student, so the roster check is built in.
// Blocks come back in the same query, not one read per student (SDD 5.4).
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  const rows = await prisma.profile.findMany({
    where: { courseId: BigInt(courseId), blocks: { some: {} } },
    include: withBlocks,
  });
  return rows.map(toProfile);
}

// Average over every rating a student has received, the same figure the profile
// page shows. Students with no reviews are left out of the map.
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
