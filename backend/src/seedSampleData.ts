import { PrismaClient } from '@prisma/client';
import { courses, enrollments, pastGroups, profiles, reviews, students } from './sampleData';

// writes everything in sampleData.ts into postgres. safe to run more than once:
// it puts the sample rows back the way the file says and leaves anything else alone.
// prisma/seed.ts calls this, and so do the database tests before they run.
export async function seedSampleData(prisma: PrismaClient) {
  const groupIds = pastGroups.map((g) => BigInt(g.id));
  const studentIds = students.map((s) => BigInt(s.id));
  const courseIds = courses.map((c) => BigInt(c.id));

  await prisma.$transaction(async (tx) => {
    // clear old sample reviews, groups and profiles first so a rerun starts clean
    await tx.peerReview.deleteMany({ where: { groupId: { in: groupIds } } });
    await tx.groupMembership.deleteMany({ where: { groupId: { in: groupIds } } });
    await tx.studyGroup.deleteMany({ where: { id: { in: groupIds } } });
    await tx.profile.deleteMany({ where: { studentId: { in: studentIds }, courseId: { in: courseIds } } });

    for (const c of courses) {
      const data = { code: c.code, title: c.title, section: c.section, term: c.term };
      await tx.course.upsert({ where: { id: BigInt(c.id) }, create: { id: BigInt(c.id), ...data }, update: data });
    }

    for (const s of students) {
      // nobody can sign in with this, real login isn't built yet
      const data = { name: s.name, schoolEmail: s.email, passwordHash: 'seed-placeholder-not-a-real-hash' };
      await tx.student.upsert({ where: { id: BigInt(s.id) }, create: { id: BigInt(s.id), ...data }, update: data });
    }

    await tx.enrollment.createMany({
      data: enrollments.map((e) => ({ studentId: BigInt(e.studentId), courseId: BigInt(e.courseId) })),
      skipDuplicates: true,
    });

    for (const p of profiles) {
      await tx.profile.create({
        data: {
          studentId: BigInt(p.studentId),
          courseId: BigInt(p.courseId),
          gradeGoal: p.gradeGoal,
          workStyle: p.workStyle,
          blocks: { create: p.blocks },
        },
      });
    }

    for (const g of pastGroups) {
      await tx.studyGroup.create({ data: { id: BigInt(g.id), courseId: BigInt(g.courseId) } });
      await tx.groupMembership.createMany({
        data: g.members.map((m) => ({ groupId: BigInt(g.id), studentId: BigInt(m), courseId: BigInt(g.courseId) })),
      });
    }

    for (const r of reviews) {
      await tx.peerReview.create({
        data: {
          reviewerId: BigInt(r.reviewerId),
          revieweeId: BigInt(r.revieweeId),
          groupId: BigInt(r.groupId),
          ratings: {
            create: [
              { criteriaName: 'Communication', rating: r.communication },
              { criteriaName: 'Reliability', rating: r.reliability },
              { criteriaName: 'Contribution', rating: r.contribution },
            ],
          },
        },
      });
    }

    // we picked the ids ourselves above, so move each id counter past them.
    // otherwise the next normal insert would try to reuse id 1 and fail.
    // only ever move it forward: if something else is adding rows while the seed
    // runs, it may already have taken an id higher than any saved row, and
    // moving the counter back would hand that id out twice
    for (const table of ['student', 'course', 'study_group']) {
      await tx.$executeRawUnsafe(
        `SELECT setval('${table}_id_seq', GREATEST((SELECT MAX(id) FROM ${table}), (SELECT last_value FROM ${table}_id_seq)))`
      );
    }
  }, { timeout: 30000 });

  return { courses: courses.length, students: students.length, profiles: profiles.length, reviews: reviews.length };
}
