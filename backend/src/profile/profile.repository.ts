import { Prisma, GradeGoal, WorkStyle } from '@prisma/client';
import { prisma } from '../db';
import type { Block } from './profile.schema';

type Tx = Prisma.TransactionClient;

export const profileRepository = {
  findStudent(studentId: bigint) {
    return prisma.student.findUnique({ where: { id: studentId } });
  },

  listEnrolledCourses(studentId: bigint) {
    return prisma.enrollment.findMany({
      where: { studentId },
      include: { course: true, profile: { select: { id: true } } },
      orderBy: { courseId: 'asc' },
    });
  },

  findProfile(studentId: bigint, courseId: bigint) {
    return prisma.profile.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
      include: { blocks: { orderBy: [{ weekday: 'asc' }, { startMinute: 'asc' }] } },
    });
  },

  async reviewAverage(studentId: bigint): Promise<number | null> {
    const r = await prisma.ratingCriterion.aggregate({
      _avg: { rating: true },
      where: { review: { revieweeId: studentId } },
    });
    return r._avg.rating;
  },

  async lockEnrollment(tx: Tx, studentId: bigint, courseId: bigint): Promise<boolean> {
    const rows = await tx.$queryRaw<unknown[]>`
      SELECT 1 FROM enrollment
      WHERE student_id = ${studentId} AND course_id = ${courseId}
      FOR UPDATE`;
    return rows.length > 0;
  },

  upsertProfile(tx: Tx, studentId: bigint, courseId: bigint, data: { gradeGoal: GradeGoal; workStyle: WorkStyle }) {
    return tx.profile.upsert({
      where: { studentId_courseId: { studentId, courseId } },
      create: { studentId, courseId, ...data },
      update: data,
    });
  },

  async replaceBlocks(tx: Tx, profileId: bigint, blocks: Block[]) {
    await tx.availabilityBlock.deleteMany({ where: { profileId } });
    await tx.availabilityBlock.createMany({ data: blocks.map((b) => ({ ...b, profileId })) });
  },

  setTutorialCompleted(studentId: bigint) {
    return prisma.student.update({ where: { id: studentId }, data: { tutorialCompleted: true } });
  },
};