import type { Request, Response } from 'express';
import { findCandidates } from '../matching/findCandidates';

// GET /api/courses/:courseId/candidates
// Thin on purpose: params are already validated by validate({ params: courseParams })
// in the route, so this just calls the matching module and sends the result.
// Errors bubble to errorHandler (Express 5 forwards rejected promises).
export async function getCandidates(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };

  // TODO (enrollment module): check the student is on this course's roster first
  // and throw StateConflictError('NOT_ENROLLED', ...) if not. findCandidates
  // assumes that check already happened.

  const studentId: string = res.locals.studentId;
  const candidates = await findCandidates(studentId, courseId);
  res.json({ courseId, candidates });
}
