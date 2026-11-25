import type { Request, Response } from 'express';
import { z } from 'zod';
import { getMe } from '../auth/accounts';
import { ApiError } from '../middleware/errorHandler';
import { idString } from '../middleware/validate';
import { startSession } from './session.controller';

export const demoSignInBody = z.object({ studentId: idString });

// post /api/demo/session, demo only, sign in from the roster, no password
export async function demoSignIn(_req: Request, res: Response) {
  const { studentId } = res.locals.body as z.infer<typeof demoSignInBody>;

  const me = await getMe(studentId);
  if (!me) throw new ApiError(404, 'NOT_FOUND', 'That student does not exist.');

  startSession(res, me.studentId);
  res.json({ studentId: me.studentId, tutorialCompleted: me.tutorialCompleted });
}
