import { Id, Profile } from './types';
import { enrollments } from '../sampleData';
import { averageFor, store } from '../memory/store';

// in memory postgresData.ts for tests and the no database demo

// like the real query, skips profiles with no availability
export async function getCourseProfiles(courseId: Id): Promise<Profile[]> {
  return store.profiles
    .filter((p) => p.courseId === courseId && p.blocks.length > 0)
    .map((p) => ({ ...p, blocks: p.blocks.map((b) => ({ ...b })) })); // copies so callers can't edit the store
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
