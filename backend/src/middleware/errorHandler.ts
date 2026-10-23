import type { ErrorRequestHandler, RequestHandler } from 'express';
import { StateConflictError } from '../matching/errors';

// SDD 10.3: modules throw typed errors, this is the one place that turns them
// into an ApiError body + HTTP status. Every error response has the same shape:
//   { error: { code, message, reason? } }
// TODO: double-check the code names against the ApiError table in SDD 10.3.

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'STATE_CONFLICT'
  | 'UNAVAILABLE';
// (RATE_LIMITED, 429, is sent directly by middleware/security.ts)

// Thrown by the API layer itself (bad params, missing session, unknown route).
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

  // Expected business-rule failures, e.g. NO_PROFILE or NOT_ENROLLED. 409 means
  // "your request is fine, but the current state doesn't allow it", which tells
  // the frontend to show the message instead of offering a retry.
  // The message is written for the user, so it's safe to pass through.
  if (err instanceof StateConflictError) {
    res.status(409).json({ error: { code: 'STATE_CONFLICT', reason: err.reason, message: err.message } });
    return;
  }

  // express.json() rejects a malformed body with this type.
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: { code: 'VALIDATION', message: 'Request body is not valid JSON.' } });
    return;
  }

  // Anything else (failed db read, bad data from the db layer) is UNAVAILABLE.
  // Log the detail server-side only (tagged with the request id); it can contain
  // ids (SDD 9.8) and the client doesn't need it.
  req.log.error({ err }, 'Unhandled request error');
  res.status(503).json({
    error: { code: 'UNAVAILABLE', message: 'Something went wrong on our end. Please try again.' },
  });
};
