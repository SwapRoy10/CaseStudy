import type { ErrorRequestHandler, RequestHandler } from 'express';
import { StateConflictError } from '../matching/errors';
// profile and enrollment throw their own classes from src/errors.ts
import { ForbiddenError, StateConflictError as ModuleConflictError, ValidationError } from '../errors';

// those classes only carry a code, these are the messages students see
const conflictMessages: Record<string, string> = {
  NOT_ENROLLED: 'Your enrollment in this class could not be verified.',
  STUDENT_NOT_FOUND: 'We could not find your account.',
  COURSE_NOT_FOUND: 'That course does not exist.',
  NO_PROFILE: 'Complete your profile to see matches.',
  NO_LONGER_ELIGIBLE: 'This classmate is no longer a match.',
  DUPLICATE_REQUEST: 'You already sent this classmate a request.',
  NOT_PENDING: 'This request has already been answered.',
  GROUP_MERGE: 'Group merging is not available in this release.',
  DUPLICATE_REVIEW: 'You have already reviewed this group member.',
};

// sdd 10.3: the one place typed errors become an http status, shape is { error: { code, message, reason? } }

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE';
// RATE_LIMITED (429) is sent by middleware/security.ts

// thrown by the api layer (bad params, no session, unknown route)
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, 'NOT_FOUND', `No route for ${req.method} ${req.path}`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }

  // expected rule failures like NO_PROFILE, 409 with a message the ui shows
  if (err instanceof StateConflictError) {
    res.status(409).json({ error: { code: 'CONFLICT', reason: err.reason, message: err.message } });
    return;
  }

  // same for profile and enrollment errors, or they would fall through to 503
  if (err instanceof ModuleConflictError) {
    const message = conflictMessages[err.code] ?? 'That is not allowed right now.';
    res.status(409).json({ error: { code: 'CONFLICT', reason: err.code, message } });
    return;
  }
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: err.message } });
    return;
  }
  if (err instanceof ValidationError) {
    // sdd 10.3 lists every bad field
    res.status(400).json({ error: { code: 'VALIDATION', message: err.message, fields: err.fields } });
    return;
  }

  // express.json() uses this type for a malformed body
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Request body is not valid JSON.' } });
    return;
  }

  // anything else is UNAVAILABLE, detail stays in the server log (sdd 9.8)
  req.log.error({ err }, 'Unhandled request error');
  res.status(503).json({
    error: { code: 'UNAVAILABLE', message: 'Something went wrong on our end. Please try again.' },
  });
};
