import { createHmac, timingSafeEqual } from 'node:crypto';
import { config } from '../config';

// signed token in a cookie, checked without a database read (sdd 9.4)

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

// student id, or null if missing, forged or expired
export function readToken(token: string | undefined, now = Date.now()): string | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null; // constant time compare

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (typeof payload.sid !== 'string' || typeof payload.exp !== 'number') return null;
    return payload.exp > now ? payload.sid : null; // expired tokens fail
  } catch {
    return null;
  }
}

// one value from the cookie header
export function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

// httpOnly hides it from scripts, sameSite strict blocks other sites, secure only in production
export const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.env === 'production',
  path: '/',
};
