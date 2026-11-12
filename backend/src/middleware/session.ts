import type { RequestHandler } from 'express';
import { ApiError } from './errorHandler';
import { idString } from './validate';

// the sdd says studentId comes from the session, never from the url or body,
// so a student can't ask for someone else's matches.
//
// demo stand-in: until real login exists, the frontend sends the signed-in
// student's id in an X-Student-Id header. replace this middleware with real
// session/auth handling. everything downstream only reads res.locals.studentId,
// so nothing else has to change.

export const requireStudent: RequestHandler = (req, res, next) => {
  const parsed = idString.safeParse(req.header('x-student-id'));
  if (!parsed.success) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
    return;
  }
  res.locals.studentId = parsed.data;
  next();
};
