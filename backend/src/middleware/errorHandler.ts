import type { ErrorRequestHandler, RequestHandler } from 'express';
import { StateConflictError } from '../matching/errors';
// profile and enrollment throw their own error classes from src/errors.ts
import { StateConflictError as ModuleConflictError, ValidationError } from '../errors';

// those classes only carry a code, so these are the messages the student sees
const conflictMessages: Record<string, string> = {
  NOT_ENROLLED: 'Your enrollment in this class could not be verified.',
  STUDENT_NOT_FOUND: 'We could not find your account.',
  COURSE_NOT_FOUND: 'That course does not exist.',
};

// sdd 10.3: modules throw typed errors, this is the one place that turns them
// into an ApiError body + http status. every error response has the same shape:
//   { error: { code, message, reason? } }
// the codes follow the ApiError table in sdd 10.3 (conflicts are CONFLICT, 409).

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAVAILABLE';
// (RATE_LIMITED, 429, is sent directly by middleware/security.ts)

// thrown by the api layer itself (bad params, missing session, unknown route).
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

  // expected business-rule failures, e.g. NO_PROFILE or NOT_ENROLLED. 409 means
  // "your request is fine, but the current state doesn't allow it", which tells
  // the frontend to show the message instead of offering a retry.
  // the message is written for the user, so it's safe to pass through.
  if (err instanceof StateConflictError) {
    res.status(409).json({ error: { code: 'CONFLICT', reason: err.reason, message: err.message } });
    return;
  }

  // same idea for the profile and enrollment modules. without these two checks
  // a missing field or NOT_ENROLLED from saveProfile would fall through to 503
  if (err instanceof ModuleConflictError) {
    const message = conflictMessages[err.code] ?? 'That is not allowed right now.';
    res.status(409).json({ error: { code: 'CONFLICT', reason: err.code, message } });
    return;
  }
  if (err instanceof ValidationError) {
    // sdd 10.3 says to list every bad field
    res.status(400).json({ error: { code: 'VALIDATION', message: err.message, fields: err.fields } });
    return;
  }

  // express.json() rejects a malformed body with this type.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Request body is not valid JSON.' } });
    return;
  }

  // anything else (failed db read, bad data from the db layer) is UNAVAILABLE.
  // log the detail server-side only (tagged with the request id); it can contain
  // ids (sdd 9.8) and the client doesn't need it.
  req.log.error({ err }, 'Unhandled request error');
  res.status(503).json({
    error: { code: 'UNAVAILABLE', message: 'Something went wrong on our end. Please try again.' },
  });
};
