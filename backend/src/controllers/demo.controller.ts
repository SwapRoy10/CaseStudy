import type { Request, Response } from 'express';
import { config } from '../config';
import { prisma } from '../db';
import { courses, enrollments, profiles, students } from '../sampleData';

// demo stand-in, same as the X-Student-Id header: there's no real login yet, so
// the frontend needs some way to pick who you are. this lists each course that
// has profiles in it, with the students on its roster. it's off in production
// (see routes/index.ts) and should be deleted once sign in exists.

interface DemoCourse {
  id: string;
  code: string;
  title: string;
  term: string;
  students: { id: string; name: string; hasProfile: boolean }[];
}

export async function getDemoRoster(_req: Request, res: Response) {
  const list = config.useMockData ? rosterFromSampleData() : await rosterFromDatabase();
  res.json({ courses: list });
}

export function rosterFromSampleData(): DemoCourse[] {
  return courses
    .filter((c) => profiles.some((p) => p.courseId === c.id))
    .map((c) => ({
      id: c.id,
      code: c.code,
      title: c.title,
      term: c.term,
      students: enrollments
        .filter((e) => e.courseId === c.id)
        .map((e) => ({
          id: e.studentId,
          name: students.find((s) => s.id === e.studentId)?.name ?? 'Unknown',
          hasProfile: profiles.some((p) => p.studentId === e.studentId && p.courseId === c.id),
        }))
        .sort((a, b) => Number(a.id) - Number(b.id)),
    }));
}

export async function rosterFromDatabase(): Promise<DemoCourse[]> {
  const rows = await prisma.course.findMany({
    where: { enrollments: { some: { profile: { isNot: null } } } },
    orderBy: { id: 'asc' },
    include: {
      enrollments: {
        orderBy: { studentId: 'asc' },
        include: { student: { select: { name: true } }, profile: { select: { id: true } } },
      },
    },
  });

  return rows.map((c) => ({
    id: c.id.toString(),
    code: c.code,
    title: c.title,
    term: c.term,
    students: c.enrollments.map((e) => ({
      id: e.studentId.toString(),
      name: e.student.name,
      hasProfile: e.profile !== null,
    })),
  }));
}
