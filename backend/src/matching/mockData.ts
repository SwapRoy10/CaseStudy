import { Id, Profile } from './types';
import { enrollments, profiles, reviewAverage } from '../sampleData';

// in memory stand-in for the postgres reads, used by the tests and by the demo
// when there's no database. the data lives in src/sampleData.ts, the same file
// the seed loads into postgres, and the functions match postgresData.ts.

function toProfile(p: (typeof profiles)[number]): Profile {
  return {
    profileId: `${p.studentId}-${p.courseId}`,
    studentId: p.studentId,
    courseId: p.courseId,
    gradeGoal: p.gradeGoal,
    workStyle: p.workStyle,
    blocks: p.blocks.map((b) => ({ ...b })),
  };
}

// like the real query, only profiles that have availability come back
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  return profiles.filter((p) => p.courseId === courseId && p.blocks.length > 0).map(toProfile);
}

export async function isEnrolled(studentId: Id, courseId: Id): Promise<boolean> {
  return enrollments.some((e) => e.studentId === studentId && e.courseId === courseId);
}

// no entry means no reviews yet
export async function getAverages(studentIds: Id[]): Promise<Map<Id, number>> {
  const result = new Map<Id, number>();
  for (const id of studentIds) {
    const avg = reviewAverage(id);
    if (avg !== null) result.set(id, avg);
  }
  return result;
}
