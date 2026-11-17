import { config } from './config';
import { prisma } from './db';
import { testsMayUseDatabase } from './localDatabase';
import { seedSampleData } from './seedSampleData';

// vitest runs this once before any test file. when there's a database, it loads
// the sample data so every database test starts from the same rows. doing it
// here instead of in each file means two files can't reseed at the same time.
export default async function setup() {
  // the tests reseed and delete rows, so a database that isn't local is switched
  // off for this run. with no DATABASE_URL the app uses the sample data in memory
  // and the database tests skip themselves (see src/localDatabase.ts)
  if (process.env.DATABASE_URL && !testsMayUseDatabase(process.env.DATABASE_URL)) {
    console.log('DATABASE_URL is not a local database, so the database tests are skipped. See database/README.md.');
    process.env.DATABASE_URL = '';
    process.env.DIRECT_URL = '';
    return;
  }

  if (config.useMockData) return;
  await seedSampleData(prisma);
  await prisma.$disconnect();
}
