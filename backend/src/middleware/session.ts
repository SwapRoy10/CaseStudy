import type { RequestHandler } from 'express';
import { ApiError } from './errorHandler';
import { idString } from './validate';

// The SDD says studentId comes from the session, never from the URL or body,
// so a student can't ask for someone else's matches.
//
// DEMO STAND-IN: until real login exists, the frontend sends the signed-in
// student's id in an X-Student-Id header. Replace this middleware with real
// session/auth handling; everything downstream only reads res.locals.studentId,
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
