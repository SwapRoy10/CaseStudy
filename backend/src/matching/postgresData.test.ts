import { afterAll, describe, expect, it } from 'vitest';
import { config } from '../config';
import { prisma } from '../db';
import { findCandidates } from './findCandidates';
import { getCourseProfiles, isEnrolled } from './postgresData';
import { CSDS_393, profiles } from '../sampleData';

// matching against a real postgres database with the seeded sample data.
// these only run when DATABASE_URL is set (npm run db:up), everywhere else they
// skip. src/globalSetup.ts seeds the database before any test runs. they cover
// the database versions of the matching cases in the functional testing doc.

describe.skipIf(config.useMockData)('matching on postgres', () => {
  const perfTag = `perf${Date.now()}`;
  let perfCourseId: bigint;
  let perfStudentIds: bigint[] = [];

  afterAll(async () => {
    // put things back the way we found them
    if (perfCourseId) {
      await prisma.profile.deleteMany({ where: { courseId: perfCourseId } });
      await prisma.enrollment.deleteMany({ where: { courseId: perfCourseId } });
      await prisma.course.delete({ where: { id: perfCourseId } });
    }
    await prisma.student.deleteMany({ where: { id: { in: perfStudentIds } } });
    await prisma.$disconnect();
  });

  // order-2, database version: same answer as the mock data, through real queries
  it('gives 101 the list [102, 106, 103] with the right shared times and averages', async () => {
    const result = await findCandidates('101', '1');
    expect(result).toEqual([
      {
        candidateId: '102',
        gradeGoal: 'A_TRACK',
        workStyle: 'GROUP',
        sharedIntervals: [
          { weekday: 1, startMinute: 600, endMinute: 660 },
          { weekday: 3, startMinute: 840, endMinute: 900 },
        ],
        reviewAverage: 3.2,
      },
      {
        candidateId: '106',
        gradeGoal: 'A_TRACK',
        workStyle: 'GROUP',
        sharedIntervals: [{ weekday: 3, startMinute: 780, endMinute: 840 }],
        reviewAverage: null,
      },
      {
        candidateId: '103',
        gradeGoal: 'A_TRACK',
        workStyle: 'SOLO',
        sharedIntervals: [{ weekday: 1, startMinute: 540, endMinute: 570 }],
        reviewAverage: 4.9,
      },
    ]);
  });

  // pool-3: matching stays inside one course
  it("keeps 501 out of course 1 and says 101 isn't on the course 2 roster", async () => {
    const ids = (await findCandidates('101', '1')).map((c) => c.candidateId);
    expect(ids).not.toContain('501');
    expect(await isEnrolled('101', '2')).toBe(false);
    expect(await isEnrolled('501', '2')).toBe(true);
  });

  // pool-2: a profile with no free time and a student with no profile
  it('leaves out 107, who has no free time, and gives 108 NO_PROFILE', async () => {
    const ids = (await getCourseProfiles('1')).map((p) => p.studentId);
    expect(ids.sort()).toEqual(['101', '102', '103', '104', '105', '106']);
    expect(await isEnrolled('108', '1')).toBe(true);
    await expect(findCandidates('108', '1')).rejects.toMatchObject({ reason: 'NO_PROFILE' });
  });

  it('reads every csds 393 profile with its blocks in one go', async () => {
    const fromDb = await getCourseProfiles(CSDS_393);
    const expected = profiles.filter((p) => p.courseId === CSDS_393);
    expect(fromDb).toHaveLength(expected.length);

    // spot check one student so we know blocks came back attached to the right person
    const maya = fromDb.find((p) => p.studentId === '1001')!;
    expect(maya.blocks).toEqual([
      { weekday: 0, startMinute: 780, endMinute: 960 },
      { weekday: 1, startMinute: 840, endMinute: 960 },
      { weekday: 3, startMinute: 840, endMinute: 960 },
    ]);
  });

  it('only gives a csds 393 student classmates with the same grade goal and some shared time', async () => {
    const result = await findCandidates('1001', CSDS_393);
    expect(result.length).toBeGreaterThan(0);
    for (const c of result) {
      expect(c.gradeGoal).toBe('A_TRACK');
      expect(c.sharedIntervals.length).toBeGreaterThan(0);
      expect(c.candidateId).not.toBe('1001');
    }
  });

  // perf-1 and perf-2 on a real database: 200 students, nobody cut off, under 3 seconds
  it('returns all 199 classmates in a 200 student course in under 3 seconds', async () => {
    perfCourseId = (await prisma.course.create({ data: { code: perfTag, title: 'perf test', section: '001', term: 'Test' } })).id;

    for (let i = 0; i < 200; i++) {
      const s = await prisma.student.create({
        data: { name: `Perf ${i}`, schoolEmail: `${perfTag}-${i}@test.edu`, passwordHash: 'x' },
      });
      perfStudentIds.push(s.id);
      await prisma.enrollment.create({ data: { studentId: s.id, courseId: perfCourseId } });
      await prisma.profile.create({
        data: {
          studentId: s.id,
          courseId: perfCourseId,
          gradeGoal: 'A_TRACK',
          workStyle: 'GROUP',
          blocks: { create: [{ weekday: 1, startMinute: 540, endMinute: 600 }] },
        },
      });
    }

    const me = perfStudentIds[0].toString();
    const started = performance.now();
    const result = await findCandidates(me, perfCourseId.toString());
    const took = performance.now() - started;

    expect(result).toHaveLength(199);
    expect(took).toBeLessThan(3000);
  }, 60000);
});
