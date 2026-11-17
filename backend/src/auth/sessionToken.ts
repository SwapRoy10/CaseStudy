import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

// the session is a signed token in a cookie, so any backend instance can check
// it without a database read (sdd 9.4). it holds the student id and an expiry,
// and it's signed with the secret from config so nobody can make their own.

export const COOKIE_NAME = 'session';
export const SESSION_HOURS = 8;

function sign(body: string) {
  return createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
}

export function createToken(studentId: string, now = Date.now()): string {
  const payload = { sid: studentId, iat: now, exp: now + SESSION_HOURS * 60 * 60 * 1000 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(body)}`;
}

// gives back the student id, or null if the token is missing, forged or expired
export function readToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.sid !== 'string' || typeof payload.exp !== 'number') return null;
    return payload.exp > now ? payload.sid : null;
  } catch {
    return null;
  }
}

// pulls one value out of the Cookie header
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

// httpOnly so scripts can't read it, sameSite strict so other sites can't send it.
// secure is left off outside production so the http://localhost demo still works.
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.env === 'production',
  path: '/',
};
