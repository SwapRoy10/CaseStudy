import type { Request, Response } from 'express';
import { findCandidates } from '../matching/findCandidates';
import { ApiError } from '../middleware/errorHandler';
import { ID_PATTERN } from '../middleware/session';

// GET /api/courses/:courseId/candidates
// Thin on purpose: validate input, call the matching module, send the result.
// Errors bubble to errorHandler (Express 5 forwards rejected promises).
export async function getCandidates(req: Request<{ courseId: string }>, res: Response) {
  const { courseId } = req.params;
  if (!ID_PATTERN.test(courseId)) {
    throw new ApiError(400, 'VALIDATION', 'courseId must be a numeric id.');
  }

  // TODO (enrollment module): check the student is on this course's roster first
  // and throw StateConflictError('NOT_ENROLLED', ...) if not. findCandidates
  // assumes that check already happened.

  const studentId: string = res.locals.studentId;
  const candidates = await findCandidates(studentId, courseId);
  res.json({ courseId, candidates });
}
