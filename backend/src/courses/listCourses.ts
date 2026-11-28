// collaborative code by the group and claude sonnet 5.5

import { config } from '../config';
import { prisma } from '../db';
import { courses as sampleCourses } from '../sampleData';
import { latestTerm } from './terms';

// sdd 6.3.1, a course as the selector shows it
export interface CourseSummary {
  courseId: string;
  code: string;
  title: string;
  section: string;
  term: string;
}

async function allCourses(): Promise<CourseSummary[]> {
  if (config.useMockData) {
    return sampleCourses.map((c) => ({ courseId: c.id, code: c.code, title: c.title, section: c.section, term: c.term }));
  }
  const rows = await prisma.course.findMany({ orderBy: { id: 'asc' } });
  return rows.map((c) => ({ courseId: c.id.toString(), code: c.code, title: c.title, section: c.section, term: c.term }));
}

// newest term of any course, null if there are none
export async function currentTerm(): Promise<string | null> {
  return latestTerm((await allCourses()).map((c) => c.term));
}

// current term only, old terms stay in the db for their groups and reviews
export async function listCourses(): Promise<CourseSummary[]> {
  const courses = await allCourses();
  const term = latestTerm(courses.map((c) => c.term));
  return term ? courses.filter((c) => c.term === term) : courses;
}
