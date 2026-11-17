import type { Request, Response } from 'express';
import { listCourses } from '../courses/listCourses';

// GET /api/courses
// this term's courses for a class selector. it lists every one of them, not just
// the ones the student is on the roster of, saving a profile does that check.
export async function getCourses(_req: Request, res: Response) {
  res.json({ courses: await listCourses() });
}
