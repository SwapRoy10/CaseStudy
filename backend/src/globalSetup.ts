// collaborative code by somesh and claude sonnet 5.5

import { config } from './config';
import { prisma } from './db';
import { testsMayUseDatabase } from './localDatabase';
import { seedSampleData } from './seedSampleData';

// vitest runs this once before any test file, so two files can't reseed at once
export default async function setup() {
  // tests delete rows, so skip any non local database (see localDatabase.ts)
  if (process.env.DATABASE_URL && !testsMayUseDatabase(process.env.DATABASE_URL)) {
    console.log('DATABASE_URL is not a local database, so the database tests are skipped. See database/README.md.');
    process.env.DATABASE_URL = '';
    process.env.DIRECT_URL = '';
    return;
  }

  if (config.useMockData) return; // no database, nothing to seed
  await seedSampleData(prisma); // every database test starts from the same rows
  await prisma.$disconnect();
}
