import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../db';
import { importRoster } from './enrollment.service';

try { process.loadEnvFile('.env'); } catch {}
const tag = `r${Date.now()}`;
let courseId: bigint;
const header = 'course_code,section,term,school_email';

describe.skipIf(!process.env.DATABASE_URL)('importRoster', () => {
  beforeAll(async () => {
    courseId = (await prisma.course.create({ data: { code: tag, section: '001', term: 'Test' } })).id;
    await prisma.student.createMany({
      data: ['a', 'b'].map((n) => ({ name: n, schoolEmail: `${tag}-${n}@test.edu`, passwordHash: 'x' })),
    });
  });

  afterAll(async () => {
    await prisma.enrollment.deleteMany({ where: { courseId } });
    await prisma.student.deleteMany({ where: { schoolEmail: { startsWith: tag } } });
    await prisma.course.delete({ where: { id: courseId } });
    await prisma.$disconnect();
  });

  it('changes nothing when one email is unknown', async () => {
    const csv = [header, `${tag},001,Test,${tag}-a@test.edu`, `${tag},001,Test,nobody@test.edu`].join('\n');
    expect(await importRoster(courseId, csv)).toEqual({ ok: false, badRows: [3] });
    expect(await prisma.enrollment.count({ where: { courseId } })).toBe(0);
  });

  it('imports valid rows and counts duplicates once', async () => {
    const row = `${tag},001,Test,${tag}-a@test.edu`;
    const csv = [header, row, row, `${tag},001,Test,${tag}-b@test.edu`].join('\n');
    expect(await importRoster(courseId, csv)).toMatchObject({ ok: true, total: 2 });
    expect(await prisma.enrollment.count({ where: { courseId } })).toBe(2);
  });
});