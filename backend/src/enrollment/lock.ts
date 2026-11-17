import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// locks the enrollment rows of two students in a course, the lower student id
// first. everything that touches a pair of students locks them in this same
// order, so two requests can't end up waiting on each other (sdd 5.3).
// false means one of them isn't on the roster.
export async function lockEnrollments(tx: Tx, courseId: bigint, a: bigint, b: bigint): Promise<boolean> {
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM enrollment
    WHERE course_id = ${courseId} AND student_id IN (${a}, ${b})
    ORDER BY student_id
    FOR UPDATE`;
  return rows.length === 2;
}
