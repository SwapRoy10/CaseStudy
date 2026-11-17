import type { Request, Response } from 'express';
import { getMe } from '../auth/accounts';
import { ApiError } from '../middleware/errorHandler';

// GET /api/me
// who the session belongs to and which courses they're on the roster of. the
// frontend calls this on load to find out if someone is already signed in.
export async function getCurrentStudent(_req: Request, res: Response) {
  const me = await getMe(res.locals.studentId);
  // a valid token for a student who no longer exists is the same as no session
  if (!me) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  res.json(me);
}
