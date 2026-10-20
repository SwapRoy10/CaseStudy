import type { RequestHandler } from 'express';
import { ApiError } from './errorHandler';

// The SDD says studentId comes from the session, never from the URL or body,
// so a student can't ask for someone else's matches.
//
// DEMO STAND-IN: until real login exists, the frontend sends the signed-in
// student's id in an X-Student-Id header. Replace this middleware with real
// session/auth handling; everything downstream only reads res.locals.studentId,
// so nothing else has to change.

export const ID_PATTERN = /^\d+$/; // ids are Postgres bigints sent as strings

export const requireStudent: RequestHandler = (req, res, next) => {
  const studentId = req.header('x-student-id');
  if (!studentId || !ID_PATTERN.test(studentId)) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
    return;
  }
  res.locals.studentId = studentId;
  next();
};
