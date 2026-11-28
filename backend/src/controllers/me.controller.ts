// collaborative code by somesh and claude sonnet 5.5

import type { Request, Response } from 'express';
import { z } from 'zod';
import { findAccountById, getMe, markTutorialComplete, setPasswordHash } from '../auth/accounts';
import { hashPassword, verifyPassword } from '../auth/password';
import { ApiError } from '../middleware/errorHandler';

// get /api/me, who is signed in and their courses
export async function getCurrentStudent(_req: Request, res: Response) {
  const me = await getMe(res.locals.studentId);
  // token for a deleted student counts as no session
  if (!me) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');
  res.json(me);
}

export const passwordBody = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'must be at least 8 characters').max(128),
});

// put /api/me/password, roster import accounts start with a random one
export async function changePassword(_req: Request, res: Response) {
  const { currentPassword, newPassword } = res.locals.body as z.infer<typeof passwordBody>;

  const account = await findAccountById(res.locals.studentId);
  if (!account) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign in to continue.');

  if (!(await verifyPassword(account.passwordHash, currentPassword))) {
    throw new ApiError(400, 'VALIDATION', 'currentPassword: that is not your current password');
  }
  if (currentPassword === newPassword) {
    throw new ApiError(400, 'VALIDATION', 'newPassword: pick a password you are not using now');
  }

  await setPasswordHash(account.id, await hashPassword(newPassword));
  res.status(204).end();
}

// post /api/me/tutorial-complete, stops the tutorial reopening (ud-2)
export async function completeTutorial(_req: Request, res: Response) {
  await markTutorialComplete(res.locals.studentId);
  res.status(204).end();
}
