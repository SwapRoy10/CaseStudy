import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../db';
import { importRoster, importRosterWithReasons } from './enrollment.service';

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

  // a canvas gradebook export, like the one in database/sample-canvas-roster.csv.
  // these get their own course and @case.edu students, so the login id turns into
  // an email with the real default domain
  describe('canvas gradebook export', () => {
    const canvasHeader = 'Student,ID,SIS User ID,SIS Login ID,Section,Assignment 1';
    let canvasCourse: bigint;
    const enrolled = () => prisma.enrollment.count({ where: { courseId: canvasCourse } });

    beforeAll(async () => {
      canvasCourse = (await prisma.course.create({ data: { code: `${tag}c`, section: '001', term: 'Test' } })).id;
      await prisma.student.createMany({
        data: [`${tag}x@case.edu`, `${tag}y@case.edu`, `${tag}Z@CASE.EDU`].map((e) => ({
          name: e,
          schoolEmail: e,
          passwordHash: 'x',
        })),
      });
    });

    afterAll(async () => {
      await prisma.enrollment.deleteMany({ where: { courseId: canvasCourse } });
      await prisma.course.delete({ where: { id: canvasCourse } });
    });

    it('lists every row it cannot use and changes nothing', async () => {
      const csv = [
        canvasHeader,
        `"Student, X",1,2,${tag}x,S,`,
        '"Student, B",3,4,,S,',
        '"Student, C",5,6,ghost,S,',
      ].join('\n');
      expect(await importRosterWithReasons(canvasCourse, csv)).toEqual({
        ok: false,
        rows: [
          { row: 3, reason: 'no login id' },
          { row: 4, reason: 'no account for that email' },
        ],
      });
      expect(await enrolled()).toBe(0);
    });

    it('enrolls students by login id and skips the points row and test student', async () => {
      const csv = [
        canvasHeader,
        '    Points Possible,,,,,100',
        `"Student, X",1,2,${tag}x,S,`,
        `"Student, Y",3,4,${tag}y,S,`,
        '"Student, Test",5,,,S,',
      ].join('\n');
      expect(await importRosterWithReasons(canvasCourse, csv)).toEqual({ ok: true, added: 2, total: 2 });
      expect(await enrolled()).toBe(2);
    });

    it('finds an account even when the email is saved in capitals', async () => {
      const csv = [canvasHeader, `"Student, Z",1,2,${tag}z,S,`].join('\n');
      expect(await importRosterWithReasons(canvasCourse, csv)).toEqual({ ok: true, added: 1, total: 1 });
    });

    it('counts a student already on the roster as enrolled but not added', async () => {
      const csv = [canvasHeader, `"Student, X",1,2,${tag}x,S,`].join('\n');
      expect(await importRosterWithReasons(canvasCourse, csv)).toEqual({ ok: true, added: 0, total: 1 });
    });

    it('gives just the bad row numbers through the original importRoster', async () => {
      const csv = [canvasHeader, `"Student, X",1,2,${tag}x,S,`, '"Student, C",5,6,ghost,S,'].join('\n');
      expect(await importRoster(canvasCourse, csv)).toEqual({ ok: false, badRows: [3] });
    });

    it('rejects a file with no login column', async () => {
      await expect(importRosterWithReasons(canvasCourse, 'Student,Section\nA,S')).rejects.toThrow(/header/);
    });

    it('rejects a file with only a header', async () => {
      await expect(importRosterWithReasons(canvasCourse, canvasHeader)).rejects.toThrow(/file/);
    });

    it('says when the course does not exist', async () => {
      await expect(importRosterWithReasons(999999999n, `${canvasHeader}\nA,1,2,x,S,`)).rejects.toThrow('COURSE_NOT_FOUND');
    });
  });

  it('rejects an sdd row that names a different course', async () => {
    const csv = [header, `other,001,Test,${tag}-a@test.edu`].join('\n');
    expect(await importRosterWithReasons(courseId, csv)).toEqual({
      ok: false,
      rows: [{ row: 2, reason: 'row is for a different course' }],
    });
  });
});
