import { currentTerm } from '../courses/listCourses';
import { prisma } from '../db';
import { Account, Me } from './types';

// postgres reads for sign in. ids are bigint in the database but strings
// everywhere else, so they get converted here.

export async function findAccountByEmail(email: string): Promise<Account | null> {
  // emails are saved however the roster spelled them, so compare without case
  const row = await prisma.student.findFirst({ where: { schoolEmail: { equals: email, mode: 'insensitive' } } });
  return row && toAccount(row);
}

export async function findAccountById(studentId: string): Promise<Account | null> {
  const row = await prisma.student.findUnique({ where: { id: BigInt(studentId) } });
  return row && toAccount(row);
}

export async function setPasswordHash(studentId: string, passwordHash: string): Promise<void> {
  await prisma.student.update({ where: { id: BigInt(studentId) }, data: { passwordHash } });
}

export async function markTutorialComplete(studentId: string): Promise<void> {
  await prisma.student.update({ where: { id: BigInt(studentId) }, data: { tutorialCompleted: true } });
}

function toAccount(row: { id: bigint; name: string; passwordHash: string; tutorialCompleted: boolean }): Account {
  return {
    id: row.id.toString(),
    name: row.name,
    passwordHash: row.passwordHash,
    tutorialCompleted: row.tutorialCompleted,
  };
}

export async function getMe(studentId: string): Promise<Me | null> {
  const row = await prisma.student.findUnique({
    where: { id: BigInt(studentId) },
    include: {
      enrollments: {
        orderBy: { courseId: 'asc' },
        include: { course: true, profile: { select: { id: true } } },
      },
    },
  });
  if (!row) return null;
  // only this term's courses, past semesters are just there for old groups and reviews
  const term = await currentTerm();
  return {
    studentId: row.id.toString(),
    name: row.name,
    tutorialCompleted: row.tutorialCompleted,
    courses: row.enrollments
      .filter((e) => term === null || e.course.term === term)
      .map((e) => ({
        id: e.courseId.toString(),
        code: e.course.code,
        title: e.course.title,
        section: e.course.section,
        term: e.course.term,
        hasProfile: e.profile !== null,
      })),
  };
}
