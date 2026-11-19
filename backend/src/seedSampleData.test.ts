import { afterAll, describe, expect, it, vi } from 'vitest';
import { config } from './config';
import { prisma } from './db';
import { hashPassword, verifyPassword } from './auth/password';
import { seedSampleData } from './seedSampleData';
import { DEMO_PASSWORD, reviewAverage, reviews, students } from './sampleData';

it('has no review average for a student who has received no ratings', () => {
  expect(reviewAverage('108')).toBeNull();
});

// the seed already ran once in globalSetup.ts. these run it again to make sure
// it really is safe to rerun, since the readme tells people to do exactly that

describe.skipIf(config.useMockData)('seedSampleData', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('can run twice without doubling anything', async () => {
    await seedSampleData(prisma);

    const ids = students.map((s) => BigInt(s.id));
    expect(await prisma.student.count({ where: { id: { in: ids } } })).toBe(students.length);
    expect(await prisma.profile.count({ where: { courseId: 3n } })).toBe(34);
    expect(await prisma.enrollment.count({ where: { courseId: 3n } })).toBe(36);
    expect(await prisma.peerReview.count({ where: { groupId: { in: [1n, 2n, 3n, 4n, 5n] } } })).toBe(reviews.length);
  });

  it('gives the same review averages in postgres as sampleData.ts works out', async () => {
    for (const id of ['102', '103', '1001', '1008']) {
      const r = await prisma.ratingCriterion.aggregate({ _avg: { rating: true }, where: { review: { revieweeId: BigInt(id) } } });
      expect(r._avg.rating).toBeCloseTo(reviewAverage(id)!, 10);
    }
  });

  it('moves the id counters past the seeded ids, so new students still get an id', async () => {
    const s = await prisma.student.create({
      data: { name: 'New Student', schoolEmail: `seedtest${Date.now()}@test.edu`, passwordHash: 'x' },
    });
    expect(s.id).toBeGreaterThan(1036n);
    await prisma.student.delete({ where: { id: s.id } });
  });

  // this one used to fail now and then when the 200 student test was adding
  // students at the same moment. it takes an id the way a running insert would,
  // before that insert has saved its row, then reseeds
  it('never hands out an id that something else already took while it ran', async () => {
    const [{ taken }] = await prisma.$queryRaw<{ taken: bigint }[]>`SELECT nextval('student_id_seq') AS taken`;
    await seedSampleData(prisma);

    const s = await prisma.student.create({
      data: { name: 'After Seed', schoolEmail: `seedrace${Date.now()}@test.edu`, passwordHash: 'x' },
    });
    expect(s.id).toBeGreaterThan(taken);
    await prisma.student.delete({ where: { id: s.id } });
  });

  // the seed uses fixed ids, so on a shared database it must not replace rows that
  // belong to someone else
  describe('on a database with other people in it', () => {
    it('stops when a sample student id belongs to a real account', async () => {
      const before = await prisma.student.findUniqueOrThrow({ where: { id: 999n } });
      // a different hash, like a real student who signed up with their own password
      const real = await hashPassword('their own password');
      await prisma.student.update({
        where: { id: 999n },
        data: { passwordHash: real, name: 'Real Person', schoolEmail: 'real.person@somewhere.edu' },
      });
      try {
        await expect(seedSampleData(prisma)).rejects.toThrow(/student id 999 .* not overwriting/);
        const after = await prisma.student.findUniqueOrThrow({ where: { id: 999n } });
        expect(after.name).toBe('Real Person');
      } finally {
        await prisma.student.update({
          where: { id: 999n },
          data: { passwordHash: before.passwordHash, name: before.name, schoolEmail: before.schoolEmail },
        });
      }
    });

    it('is fine when a sample student has changed their password', async () => {
      const before = await prisma.student.findUniqueOrThrow({ where: { id: 999n } });
      await prisma.student.update({ where: { id: 999n }, data: { passwordHash: await hashPassword('picked their own') } });
      try {
        await expect(seedSampleData(prisma)).resolves.toBeDefined();
      } finally {
        await prisma.student.update({ where: { id: 999n }, data: { passwordHash: before.passwordHash } });
      }
    });

    it('stops when a sample course has a real student on its roster', async () => {
      // course 4 is a past semester, no other test looks at its roster
      const outsider = await prisma.student.create({
        data: { name: 'Real Person', schoolEmail: `outsider${Date.now()}@test.edu`, passwordHash: await hashPassword('x') },
      });
      await prisma.enrollment.create({ data: { studentId: outsider.id, courseId: 4n } });
      try {
        await expect(seedSampleData(prisma)).rejects.toThrow(/course id 4 .* not overwriting/);
      } finally {
        await prisma.enrollment.deleteMany({ where: { studentId: outsider.id } });
        await prisma.student.delete({ where: { id: outsider.id } });
      }
    });

    it('goes ahead anyway with SEED_FORCE=true', async () => {
      const real = await hashPassword('their own password');
      await prisma.student.update({ where: { id: 999n }, data: { passwordHash: real, schoolEmail: 'real.person@somewhere.edu' } });
      process.env.SEED_FORCE = 'true';
      try {
        await seedSampleData(prisma);
      } finally {
        delete process.env.SEED_FORCE;
      }
      // put back as sample data, with the demo password
      const row = await prisma.student.findUniqueOrThrow({ where: { id: 999n } });
      expect(await verifyPassword(row.passwordHash, DEMO_PASSWORD)).toBe(true);
    });

    it('recognizes renamed sample accounts sharing the original demo password', async () => {
      const passwordHash = await hashPassword(DEMO_PASSWORD);
      const findMany = vi.spyOn(prisma.student, 'findMany').mockResolvedValueOnce(
        [101n, 102n].map((id) => ({
          id,
          name: 'Renamed Demo Student',
          schoolEmail: `renamed${id}@test.edu`,
          passwordHash,
          tutorialCompleted: false,
        })),
      );
      try {
        await seedSampleData(prisma);
        expect(findMany).toHaveBeenCalled();
      } finally {
        findMany.mockRestore();
      }
    });

    it('is fine with a database that still has the old placeholder hash', async () => {
      await prisma.student.update({
        where: { id: 999n },
        data: { passwordHash: 'seed-placeholder-not-a-real-hash', schoolEmail: 'real.person@somewhere.edu' },
      });
      await expect(seedSampleData(prisma)).resolves.toBeDefined();
    });
  });
});
