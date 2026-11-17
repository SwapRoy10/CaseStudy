import type { Request, Response } from 'express';
import { z } from 'zod';
import { getMe } from '../auth/accounts';
import { ApiError } from '../middleware/errorHandler';
import { idString } from '../middleware/validate';
import { startSession } from './session.controller';

export const demoSignInBody = z.object({ studentId: idString });

// POST /api/demo/session
// demo only, the partner of GET /api/demo/roster: pick a student from that list
// and you're signed in as them, with no password. it's off in production (see
// routes/index.ts), so real students always sign in with a password. delete it
// along with the roster route once the demo is over.
export async function demoSignIn(_req: Request, res: Response) {
  const { studentId } = res.locals.body as z.infer<typeof demoSignInBody>;

  const me = await getMe(studentId);
  if (!me) throw new ApiError(404, 'NOT_FOUND', 'That student does not exist.');

  startSession(res, me.studentId);
  res.json({ studentId: me.studentId, tutorialCompleted: me.tutorialCompleted });
}
