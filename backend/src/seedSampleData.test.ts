import { afterAll, describe, expect, it } from 'vitest';
import { config } from './config';
import { prisma } from './db';
import { seedSampleData } from './seedSampleData';
import { reviewAverage, reviews, students } from './sampleData';

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
});
