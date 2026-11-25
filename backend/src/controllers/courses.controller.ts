import type { Request, Response } from 'express';
import { listCourses } from '../courses/listCourses';

// get /api/courses, this term's courses for the selector
export async function getCourses(_req: Request, res: Response) {
  res.json({ courses: await listCourses() });
}
