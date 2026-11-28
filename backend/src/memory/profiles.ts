// collaborative code by the group and claude sonnet 5.5

import { ValidationError, StateConflictError, toId } from '../errors';
import { students } from '../sampleData';
import { profileInputSchema, normalizeBlocks } from '../profile/profile.schema';
import { averageFor, isEnrolled, store } from './store';

// same two functions as profile/profile.service.ts, on the in memory store

export async function getOwnProfile(studentId: bigint, courseIdRaw: string | bigint) {
  const courseId = toId(courseIdRaw, 'courseId').toString();
  const student = students.find((s) => s.id === studentId.toString());
  if (!student) throw new StateConflictError('STUDENT_NOT_FOUND');

  const profile = store.profiles.find((p) => p.studentId === student.id && p.courseId === courseId);
  const avg = averageFor(student.id);

  return {
    courseId,
    name: student.name,
    schoolEmail: student.email,
    gradeGoal: profile?.gradeGoal ?? null,
    workStyle: profile?.workStyle ?? null,
    blocks: (profile?.blocks ?? [])
      .map((b) => ({ ...b }))
      .sort((a, b) => a.weekday - b.weekday || a.startMinute - b.startMinute),
    reviewAverage: avg === null ? 'Not yet rated' : avg.toFixed(1),
  };
}

export async function saveProfile(studentId: bigint, courseIdRaw: string | bigint, input: unknown) {
  const courseId = toId(courseIdRaw, 'courseId').toString();
  const id = studentId.toString();

  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'body');
    throw new ValidationError([...new Set(fields)]);
  }
  const blocks = normalizeBlocks(parsed.data.blocks);
  if (!isEnrolled(id, courseId)) throw new StateConflictError('NOT_ENROLLED');

  const saved = {
    profileId: `${id}-${courseId}`,
    studentId: id,
    courseId,
    gradeGoal: parsed.data.gradeGoal,
    workStyle: parsed.data.workStyle,
    blocks,
  };
  const at = store.profiles.findIndex((p) => p.studentId === id && p.courseId === courseId);
  if (at >= 0) store.profiles[at] = saved; // replace the old one
  else store.profiles.push(saved);

  return getOwnProfile(studentId, courseId);
}
