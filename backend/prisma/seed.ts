// collaborative code by the group and claude sonnet 5.5
// some parts are original code by marana, written by hand

import { PrismaClient } from '@prisma/client';
import { seedSampleData } from '../src/seedSampleData';

// run with `npm run db:seed`, data is in src/sampleData.ts
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
