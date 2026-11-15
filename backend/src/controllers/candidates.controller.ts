import type { Request, Response } from 'express';
import { isEnrolled } from '../matching/data';
import { StateConflictError } from '../matching/errors';
import { findCandidates } from '../matching/findCandidates';

// GET /api/courses/:courseId/candidates
// thin on purpose: params are already validated by validate({ params: courseParams })
// in the route, so this just calls the matching module and sends the result.
// checks the roster before matching runs, since findCandidates assumes it.
// errors bubble to errorHandler (express 5 forwards rejected promises).
export async function getCandidates(_req: Request, res: Response) {
  const { courseId } = res.locals.params as { courseId: string };

  // from the session, never the url, so nobody can request another student's matches
  const studentId: string = res.locals.studentId;
  if (!(await isEnrolled(studentId, courseId))) {
    throw new StateConflictError('NOT_ENROLLED', 'Your enrollment in this class could not be verified.');
  }

  const candidates = await findCandidates(studentId, courseId);
  res.json({ courseId, candidates });
}
