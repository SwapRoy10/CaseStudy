import { PrismaClient } from '@prisma/client';
import { seedSampleData } from '../src/seedSampleData';

// run with `npx prisma db seed` (or `npm run db:seed` from the repo root).
// the actual data is in src/sampleData.ts
const prisma = new PrismaClient();

seedSampleData(prisma)
  .then((counts) => {
    console.log(
      `seeded ${counts.students} students, ${counts.courses} courses, ` +
        `${counts.profiles} profiles and ${counts.reviews} reviews`
    );
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
