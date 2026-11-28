// collaborative code by the group and claude sonnet 5.5

import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { config } from '../config';
import { ApiError } from './errorHandler';

// roster import is operator only (sdd 9.5), key in the X-Operator-Key header

// hash both so lengths match for timingSafeEqual and timing leaks nothing
function sameKey(a: string, b: string) {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

export const requireOperator: RequestHandler = (req, _res, next) => {
  const given = req.header('x-operator-key');
  // no key configured means import is off, not open
  if (!config.operatorKey || !given || !sameKey(config.operatorKey, given)) {
    next(new ApiError(403, 'FORBIDDEN', 'You are not allowed to do that.'));
    return;
  }
  next();
};
