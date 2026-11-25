import type { Request, Response } from 'express';
import { requireEnrolled } from '../enrollment/requireEnrolled';
import { findCandidates } from '../matching/findCandidates';

// get /api/courses/:courseId/candidates, thin, params already validated
export async function getCandidates(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };

  // from the session, never the url, so nobody can read another student's matches
  const studentId: string = res.locals.studentId;
  await requireEnrolled(studentId, courseId); // findCandidates assumes this already passed

  const candidates = await findCandidates(studentId, courseId);
  res.json({ courseId, candidates });
}
