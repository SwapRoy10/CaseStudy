import type { RequestHandler } from 'express';
import { config } from '../config';
import { ApiError } from './errorHandler';

// requests, groups, reviews and saving a profile write to the database, and
// there's no in memory version of those. with no DATABASE_URL (the mock data
// demo) they answer 503 instead of failing in some confusing way.
export const requireDatabase: RequestHandler = (_req, _res, next) => {
  if (config.useMockData) {
    next(new ApiError(503, 'UNAVAILABLE', 'This needs the database. Set DATABASE_URL in backend/.env and restart.'));
    return;
  }
  next();
};
