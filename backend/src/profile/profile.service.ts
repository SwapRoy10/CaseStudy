import { prisma } from '../db';
import { ValidationError, StateConflictError, toId } from '../errors';
import { profileRepository as repo } from './profile.repository';
import { profileInputSchema, normalizeBlocks } from './profile.schema';

// studentId always comes from the logged-in session, never from the request body.

export async function listCourses(studentId: bigint) {
  const rows = await repo.listEnrolledCourses(studentId);
  return rows.map((e) => ({
    id: e.course.id.toString(),
    code: e.course.code,
    section: e.course.section,
    term: e.course.term,
    hasProfile: e.profile !== null,
  }));
}

export async function getOwnProfile(studentId: bigint, courseIdRaw: string | bigint) {
  const courseId = toId(courseIdRaw, 'courseId');
  const [student, profile, avg] = await Promise.all([
    repo.findStudent(studentId),
    repo.findProfile(studentId, courseId),
    repo.reviewAverage(studentId),
  ]);
  if (!student) throw new StateConflictError('STUDENT_NOT_FOUND');

  return {
    courseId: courseId.toString(),
    name: student.name,
    schoolEmail: student.schoolEmail,
    gradeGoal: profile?.gradeGoal ?? null,
    workStyle: profile?.workStyle ?? null,
    blocks: profile?.blocks.map(({ weekday, startMinute, endMinute }) => ({ weekday, startMinute, endMinute })) ?? [],
    reviewAverage: avg === null ? 'Not yet rated' : avg.toFixed(1),
  };
}

export async function saveProfile(studentId: bigint, courseIdRaw: string | bigint, input: unknown) {
  const courseId = toId(courseIdRaw, 'courseId');

  const parsed = profileInputSchema.safeParse(input);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join('.') || 'body');
    throw new ValidationError([...new Set(fields)]);
  }
  const { gradeGoal, workStyle } = parsed.data;
  const blocks = normalizeBlocks(parsed.data.blocks);

  // All-or-nothing: if anything throws, the old profile stays untouched.
  await prisma.$transaction(async (tx) => {
    const enrolled = await repo.lockEnrollment(tx, studentId, courseId);
    if (!enrolled) throw new StateConflictError('NOT_ENROLLED');
    const profile = await repo.upsertProfile(tx, studentId, courseId, { gradeGoal, workStyle });
    await repo.replaceBlocks(tx, profile.id, blocks);
  });

  return getOwnProfile(studentId, courseId);
}

export async function completeTutorial(studentId: bigint) {
  await repo.setTutorialCompleted(studentId);
}
