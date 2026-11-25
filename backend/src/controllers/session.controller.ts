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

// checked for unknown emails so the timing matches a wrong password
let fakeHash: Promise<string> | undefined;
function getFakeHash() {
  fakeHash ??= hashPassword('not-a-real-password');
  return fakeHash;
}

// post /api/session, same message for a wrong email or password (sdd 9.3)
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

// sets the session cookie, the demo sign in uses it too
export function startSession(res: Response, studentId: string) {
  res.cookie(COOKIE_NAME, createToken(studentId), {
    ...cookieOptions,
    maxAge: SESSION_HOURS * 60 * 60 * 1000,
  });
}

// delete /api/session, clears the cookie only (token lives until it expires)
export function signOut(_req: Request, res: Response) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.status(204).end();
}
