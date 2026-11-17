import { Id, Profile } from './types';
import { enrollments } from '../sampleData';
import { averageFor, store } from '../memory/store';

// in memory stand-in for the postgres reads, used by the tests and by the demo
// when there's no database. it reads memory/store.ts, which starts as the rows in
// src/sampleData.ts (the same ones the seed loads into postgres) and keeps any
// profile a student saves. the functions match postgresData.ts.

// like the real query, only profiles that have availability come back
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  return store.profiles
    .filter((p) => p.courseId === courseId && p.blocks.length > 0)
    .map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b })) }));
}

export async function isEnrolled(studentId: Id, courseId: Id): Promise<boolean> {
  return enrollments.some((e) => e.studentId === studentId && e.courseId === courseId);
}

// no entry means no reviews yet
export async function getAverages(studentIds: Id[]): Promise<Map<Id, number>> {
  const result = new Map<Id, number>();
  for (const id of studentIds) {
    const avg = averageFor(id);
    if (avg !== null) result.set(id, avg);
  }
  return result;
}
