import { config } from './config';
import { prisma } from './db';
import { seedSampleData } from './seedSampleData';

// vitest runs this once before any test file. when there's a database, it loads
// the sample data so every database test starts from the same rows. doing it
// here instead of in each file means two files can't reseed at the same time.
export default async function setup() {
  if (config.useMockData) return;
  await seedSampleData(prisma);
  await prisma.$disconnect();
}
