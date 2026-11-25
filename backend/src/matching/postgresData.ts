import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { Id, Profile } from './types';

// postgres reads for matching (sdd 5.4), bigint ids here, strings elsewhere

const withBlocks = { blocks: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } } satisfies Prisma.ProfileInclude;

type ProfileRow = Prisma.ProfileGetPayload<{ include: typeof withBlocks }>;

// exported so requests can turn rows from its own transaction into profiles
export function toProfile(row: ProfileRow): Profile {
  return {
    profileId: row.id.toString(), // bigint to string
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

// enrolled students only, blocks in the same query (sdd 5.4)
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  const rows = await prisma.profile.findMany({
    where: { courseId: BigInt(courseId), blocks: { some: {} } }, // skip profiles with no free time
    include: withBlocks,
  });
  return rows.map(toProfile);
}

// average of a student's ratings, no reviews means missing from the map
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
