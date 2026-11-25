import { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

// locks both rows, lower id first (sdd 5.3), false if not on the roster
export async function lockEnrollments(tx: Tx, courseId: bigint, a: bigint, b: bigint): Promise<boolean> {
  const rows = await tx.$queryRaw<unknown[]>`
    SELECT 1 FROM enrollment
    WHERE course_id = ${courseId} AND student_id IN (${a}, ${b})
    ORDER BY student_id
    FOR UPDATE`;
  return rows.length === 2; // both rows found
}
