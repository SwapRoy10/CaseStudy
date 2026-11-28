// collaborative code by the group and claude sonnet 5.5
// some parts are original code by swap, written by hand

import type { RequestHandler } from 'express';
import { COOKIE_NAME, readCookie, readToken } from '../auth/sessionToken';
import { ApiError } from './errorHandler';

// studentId comes from the signed cookie, never the url or body

export const requireStudent: RequestHandler = (req, res, next) => {
  const studentId = readToken(readCookie(req.headers.cookie, COOKIE_NAME));
  if (!studentId) {
    next(new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.'));
    return;
  }
  res.locals.studentId = studentId;
  next();
};

// second guard against forged cross site requests (sdd 9.4)
export const CLIENT_HEADER = 'X-Requested-With';
export const CLIENT_HEADER_VALUE = 'CaseStudy';

export const requireClientHeader: RequestHandler = (req, _res, next) => {
  const safe = ['GET', 'HEAD', 'OPTIONS'].includes(req.method); // reads don't need the header
  if (!safe && req.header(CLIENT_HEADER) !== CLIENT_HEADER_VALUE) {
    next(new ApiError(403, 'FORBIDDEN', 'That request did not come from the CaseStudy app.'));
    return;
  }
  next();
};
