import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../db';
import { saveProfile, getOwnProfile } from './profile.service';

try { process.loadEnvFile('.env'); } catch {}
const tag = `t${Date.now()}`;
let courseId: bigint, enrolledId: bigint, outsiderId: bigint;

const valid = {
  gradeGoal: 'A_TRACK',
  workStyle: 'GROUP',
  blocks: [{ weekday: 1, startMinute: 600, endMinute: 720 }],
};

describe.skipIf(!process.env.DATABASE_URL)('profile.service', () => {
  beforeAll(async () => {
    courseId = (await prisma.course.create({ data: { code: tag, section: '001', term: 'Test' } })).id;
    enrolledId = (await prisma.student.create({ data: { name: 'In', schoolEmail: `${tag}-in@test.edu`, passwordHash: 'x' } })).id;
    outsiderId = (await prisma.student.create({ data: { name: 'Out', schoolEmail: `${tag}-out@test.edu`, passwordHash: 'x' } })).id;
    await prisma.enrollment.create({ data: { studentId: enrolledId, courseId } });
  });

  afterAll(async () => {
    await prisma.profile.deleteMany({ where: { courseId } });
    await prisma.enrollment.deleteMany({ where: { courseId } });
    await prisma.student.deleteMany({ where: { schoolEmail: { startsWith: tag } } });
    await prisma.course.delete({ where: { id: courseId } });
    await prisma.$disconnect();
  });

  it('rejects a missing field with VALIDATION', async () => {
    const { workStyle, ...missing } = valid;
    await expect(saveProfile(enrolledId, courseId, missing))
      .rejects.toMatchObject({ code: 'VALIDATION', fields: ['workStyle'] });
  });

  it('rejects a student who is not on the roster and saves nothing', async () => {
    await expect(saveProfile(outsiderId, courseId, valid)).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
    expect(await prisma.profile.count({ where: { studentId: outsiderId } })).toBe(0);
  });

  it('saves a profile, then an edit replaces all blocks', async () => {
    await saveProfile(enrolledId, courseId, valid);
    const edited = await saveProfile(enrolledId, courseId, {
      ...valid,
      blocks: [{ weekday: 3, startMinute: 900, endMinute: 960 }, { weekday: 4, startMinute: 900, endMinute: 960 }],
    });
    expect(edited.blocks).toEqual([
      { weekday: 3, startMinute: 900, endMinute: 960 },
      { weekday: 4, startMinute: 900, endMinute: 960 },
    ]);
  });

  it('shows "Not yet rated" with no reviews', async () => {
    expect((await getOwnProfile(enrolledId, courseId)).reviewAverage).toBe('Not yet rated');
  });
});