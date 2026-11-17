import { DEMO_PASSWORD, courses, enrollments, profiles, students } from '../sampleData';
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

export async function findAccountByEmail(email: string): Promise<Account | null> {
  const student = students.find((s) => s.email.toLowerCase() === email.toLowerCase());
  if (!student) return null;
  return { id: student.id, name: student.name, passwordHash: await getDemoHash(), tutorialCompleted: false };
}

export async function getMe(studentId: string): Promise<Me | null> {
  const student = students.find((s) => s.id === studentId);
  if (!student) return null;
  return {
    studentId: student.id,
    name: student.name,
    tutorialCompleted: false,
    courses: enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => {
        const course = courses.find((c) => c.id === e.courseId)!;
        return {
          id: course.id,
          code: course.code,
          title: course.title,
          section: course.section,
          term: course.term,
          hasProfile: profiles.some((p) => p.studentId === studentId && p.courseId === course.id),
        };
      }),
  };
}
