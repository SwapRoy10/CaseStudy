import type { RequestHandler } from 'express';
import { COOKIE_NAME, readCookie, readToken } from '../auth/sessionToken';
import { ApiError } from './errorHandler';

// the sdd says studentId comes from the session, never from the url or body,
// so a student can't ask for someone else's matches. the session is the signed
// cookie that signing in sets (see auth/sessionToken.ts). everything downstream
// only reads res.locals.studentId.

export const requireStudent: RequestHandler = (req, res, next) => {
  const studentId = readToken(readCookie(req.headers.cookie, COOKIE_NAME));
  if (!studentId) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
    return;
  }
  res.locals.studentId = studentId;
  next();
};

// a second guard against forged requests from other sites (sdd 9.4). a page on
// another site can't add a custom header without our permission, so any
// change that arrives without it is turned away. the web client always sends it.
export const CLIENT_HEADER = 'X-Requested-With';
export const CLIENT_HEADER_VALUE = 'CaseStudy';

export const requireClientHeader: RequestHandler = (req, _res, next) => {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  if (!safe && req.header(CLIENT_HEADER) !== CLIENT_HEADER_VALUE) {
    next(new ApiError(403, 'FORBIDDEN', 'That request did not come from the CaseStudy app.'));
    return;
  }
  next();
};
