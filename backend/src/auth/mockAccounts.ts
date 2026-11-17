import { currentTerm } from '../courses/listCourses';
import { store } from '../memory/store';
import { DEMO_PASSWORD, courses, enrollments, students } from '../sampleData';
import { hashPassword } from './password';
import { Account, Me } from './types';

// in memory stand-in for postgresAccounts.ts, used by the tests and by the demo
// when there's no database. it reads the same sampleData.ts the seed loads.

// hashing takes a moment, so every sample student shares one hash made on first use
let demoHash: Promise<string> | undefined;
function getDemoHash() {
  demoHash ??= hashPassword(DEMO_PASSWORD);
  return demoHash;
}

// passwords changed since the server started. the sample students don't really
// change, so this only lives as long as the process.
const changed = new Map<string, string>();
const tutorialDone = new Set<string>();

async function toAccount(student: (typeof students)[number]): Promise<Account> {
  return {
    id: student.id,
    name: student.name,
    passwordHash: changed.get(student.id) ?? (await getDemoHash()),
    tutorialCompleted: tutorialDone.has(student.id),
  };
}

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const student = students.find((s) => s.email.toLowerCase() === email.toLowerCase());
  return student ? toAccount(student) : null;
}

export async function findAccountById(studentId: string): Promise<Account | null> {
  const student = students.find((s) => s.id === studentId);
  return student ? toAccount(student) : null;
}

export async function markTutorialComplete(studentId: string): Promise<void> {
  tutorialDone.add(studentId);
}

export async function setPasswordHash(studentId: string, passwordHash: string): Promise<void> {
  changed.set(studentId, passwordHash);
}

export async function getMe(studentId: string): Promise<Me | null> {
  const student = students.find((s) => s.id === studentId);
  if (!student) return null;
  const term = await currentTerm();
  return {
    studentId: student.id,
    name: student.name,
    tutorialCompleted: tutorialDone.has(studentId),
    courses: enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => courses.find((c) => c.id === e.courseId)!)
      // only this term's courses, like the database version
      .filter((course) => term === null || course.term === term)
      .map((course) => ({
        id: course.id,
        code: course.code,
        title: course.title,
        section: course.section,
        term: course.term,
        hasProfile: store.profiles.some((p) => p.studentId === studentId && p.courseId === course.id),
      })),
  };
}
