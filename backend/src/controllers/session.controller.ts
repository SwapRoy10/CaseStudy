import type { Request, Response } from 'express';
import { z } from 'zod';
import { findAccountByEmail } from '../auth/accounts';
import { hashPassword, verifyPassword } from '../auth/password';
import { COOKIE_NAME, SESSION_HOURS, cookieOptions, createToken } from '../auth/sessionToken';
import { ApiError } from '../middleware/errorHandler';

export const signInBody = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

// checked when the email has no account, so that answer takes about as long as
// a wrong password and nobody can tell which emails exist from the timing
let fakeHash: Promise<string> | undefined;
function getFakeHash() {
  fakeHash ??= hashPassword('not-a-real-password');
  return fakeHash;
}

// POST /api/session
// a wrong email and a wrong password get the same message on purpose (sdd 9.3)
export async function signIn(_req: Request, res: Response) {
  const { email, password } = res.locals.body as z.infer<typeof signInBody>;

  const account = await findAccountByEmail(email.trim().toLowerCase());
  const passwordOk = await verifyPassword(account?.passwordHash ?? (await getFakeHash()), password);
  if (!account || !passwordOk) {
    throw new ApiError(401, 'UNAUTHENTICATED', 'Email or password is incorrect.');
  }

  startSession(res, account.id);
  res.json({ studentId: account.id, tutorialCompleted: account.tutorialCompleted });
}

// puts the session cookie on the response. the demo sign in uses it too.
export function startSession(res: Response, studentId: string) {
  res.cookie(COOKIE_NAME, createToken(studentId), {
    ...cookieOptions,
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

// DELETE /api/session
// only clears the cookie in the browser. a token someone copied stays valid
// until it expires, which is the trade the sdd makes for stateless sessions.
export function signOut(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
}
