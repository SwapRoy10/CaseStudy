// collaborative code by the group and claude sonnet 5.5

import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword } from './auth/password';
import { REVIEW_CRITERIA } from './reviews/criteria';
import { DEMO_PASSWORD, courses, enrollments, pastGroups, profiles, reviews, students } from './sampleData';

// stop if a fixed id is taken by real data (SEED_FORCE=true skips this)
const OLD_PLACEHOLDER = 'seed-placeholder-not-a-real-hash';

async function checkNothingIsOverwritten(prisma: PrismaClient) {
  if (process.env.SEED_FORCE === 'true') return;

  const taken = await prisma.student.findMany({
    where: { id: { in: students.map((s) => BigInt(s.id)) } },
    select: { id: true, schoolEmail: true, passwordHash: true },
  });

  // sample students share one hash, so this is usually one check
  const checked = new Set<string>();
  for (const row of taken) {
    const sample = students.find((s) => s.id === row.id.toString());
    if (sample && sample.email.toLowerCase() === row.schoolEmail.toLowerCase()) continue;
    if (checked.has(row.passwordHash) || row.passwordHash === OLD_PLACEHOLDER) continue;
    if (!(await verifyPassword(row.passwordHash, DEMO_PASSWORD))) {
      throw new Error(`student id ${row.id} is already used by someone who isn't sample data, not overwriting. Use a fresh database, or SEED_FORCE=true if you're sure.`);
    }
    checked.add(row.passwordHash);
  }

  // one of our course ids with real students on it
  const sampleIds = new Set(students.map((s) => BigInt(s.id)));
  const enrolled = await prisma.enrollment.findMany({
    where: { courseId: { in: courses.map((c) => BigInt(c.id)) } },
    select: { studentId: true, courseId: true },
  });
  const outsider = enrolled.find((e) => !sampleIds.has(e.studentId));
  if (outsider) {
    throw new Error(`course id ${outsider.courseId} has students on it who aren't sample data, not overwriting. Use a fresh database, or SEED_FORCE=true if you're sure.`);
  }
}

// writes sampleData.ts into postgres, safe to rerun (resets sample rows only)
export async function seedSampleData(prisma: PrismaClient) {
  const groupIds = pastGroups.map((g) => BigInt(g.id));
  const studentIds = students.map((s) => BigInt(s.id));
  const courseIds = courses.map((c) => BigInt(c.id));

  // hash before the transaction, it has a time limit (one hash for all)
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await checkNothingIsOverwritten(prisma);

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
      const data = { name: s.name, schoolEmail: s.email, passwordHash };
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
            // same order as REVIEW_CRITERIA
            create: [r.communication, r.reliability, r.contribution].map((rating, i) => ({
              criteriaName: REVIEW_CRITERIA[i],
              rating,
            })),
          },
        },
      });
    }

    // ids were set by hand, so move each counter past them (forward only)
    for (const table of ['student', 'course', 'study_group']) {
      await tx.$executeRawUnsafe(
        `SELECT setval('${table}_id_seq', GREATEST((SELECT MAX(id) FROM ${table}), (SELECT last_value FROM ${table}_id_seq)))`
      );
    }
  }, { timeout: 30000 });

  return { courses: courses.length, students: students.length, profiles: profiles.length, reviews: reviews.length };
}
