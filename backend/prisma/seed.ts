import { PrismaClient, GradeGoal, WorkStyle } from '@prisma/client';

const prisma = new PrismaClient();

const students: { name: string; email: string; goal: GradeGoal; style: WorkStyle; blocks: [number, number, number][] }[] = [
  { name: 'Ava Patel',     email: 'ava@school.edu',    goal: 'A_TRACK',    style: 'GROUP', blocks: [[1, 1080, 1260], [3, 1080, 1260]] },
  { name: 'Ben Ortiz',     email: 'ben@school.edu',    goal: 'A_TRACK',    style: 'GROUP', blocks: [[1, 1140, 1320], [4, 600, 720]] },
  { name: 'Chloe Kim',     email: 'chloe@school.edu',  goal: 'PASS_TRACK', style: 'SOLO',  blocks: [[2, 840, 960]] },
  { name: 'Dev Shah',      email: 'dev@school.edu',    goal: 'PASS_TRACK', style: 'GROUP', blocks: [[2, 900, 1020], [5, 780, 900]] },
  { name: 'Ella Nguyen',   email: 'ella@school.edu',   goal: 'A_TRACK',    style: 'SOLO',  blocks: [[3, 1020, 1200]] },
  { name: 'Finn Mueller',  email: 'finn@school.edu',   goal: 'PASS_TRACK', style: 'GROUP', blocks: [[0, 720, 900], [6, 600, 780]] },
];

async function main() {
  const course = await prisma.course.upsert({
    where: { code_section_term: { code: 'CS 3100', section: '001', term: 'Fall 2026' } },
    create: { code: 'CS 3100', section: '001', term: 'Fall 2026' },
    update: {},
  });

  for (const s of students) {
    const student = await prisma.student.upsert({
      where: { schoolEmail: s.email },
      create: { name: s.name, schoolEmail: s.email, passwordHash: 'seed-placeholder-not-a-real-hash' },
      update: { name: s.name },
    });
    const key = { studentId: student.id, courseId: course.id };
    await prisma.enrollment.upsert({ where: { studentId_courseId: key }, create: key, update: {} });

    const profile = await prisma.profile.upsert({
      where: { studentId_courseId: key },
      create: { ...key, gradeGoal: s.goal, workStyle: s.style },
      update: { gradeGoal: s.goal, workStyle: s.style },
    });
    await prisma.availabilityBlock.deleteMany({ where: { profileId: profile.id } });
    await prisma.availabilityBlock.createMany({
      data: s.blocks.map(([weekday, startMinute, endMinute]) => ({ profileId: profile.id, weekday, startMinute, endMinute })),
    });
  }
  console.log(`Seeded ${students.length} students in ${course.code}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());