import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config';
import { ApiError } from './errorHandler';

// roster import is for the team operator, not for students (sdd 9.5). the
// operator sends the key from OPERATOR_KEY in an X-Operator-Key header. a student
// session doesn't count, so a signed in student gets the same 403 as anyone else.

// hashing both first makes them the same length, which timingSafeEqual needs,
// and means the comparison time doesn't depend on how much of the key matched
function sameKey(a: string, b: string) {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export const requireOperator: RequestHandler = (req, _res, next) => {
  const given = req.header('x-operator-key');
  // with no key configured the import is off, not open to everyone
  if (!config.operatorKey || !given || !sameKey(config.operatorKey, given)) {
    next(new ApiError(403, 'FORBIDDEN', 'You are not allowed to do that.'));
    return;
  }
  next();
};
