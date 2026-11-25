import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { COOKIE_NAME, createToken } from './auth/sessionToken';
import { hashPassword } from './auth/password';
import { config } from './config';
import { prisma } from './db';
import { DEMO_PASSWORD } from './sampleData';

// sign in, sign out and the session cookie, through the real app

const CLIENT = { 'X-Requested-With': 'CaseStudy' };
const signIn = (app: ReturnType<typeof createApp>, email: string, password: string) =>
  request(app).post('/api/session').set(CLIENT).send({ email, password });

// pulls the session cookie out of a sign in response
function sessionCookie(res: request.Response): string {
  const header = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_NAME}=`))!;
  return header.split(';')[0];
}

describe('POST /api/session', () => {
  const app = createApp();

  it('signs in with the right email and password', async () => {
    const res = await signIn(app, 'axr101@case.edu', DEMO_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ studentId: '101', tutorialCompleted: false });
  });

  it('ignores case and spaces around the email', async () => {
    const res = await signIn(app, '  AXR101@Case.edu ', DEMO_PASSWORD);
    expect(res.status).toBe(200);
    expect(res.body.studentId).toBe('101');
  });

  it('sets a cookie scripts cannot read and other sites cannot send', async () => {
    const res = await signIn(app, 'axr101@case.edu', DEMO_PASSWORD);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_NAME}=`))!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('Path=/');
    // 8 hours
    expect(cookie).toContain('Max-Age=28800');
  });

  it('gives the same answer for a wrong password and an email with no account', async () => {
    const wrongPassword = await signIn(app, 'axr101@case.edu', 'not the password');
    const noAccount = await signIn(app, 'nobody@case.edu', DEMO_PASSWORD);
    expect(wrongPassword.status).toBe(401);
    expect(noAccount.status).toBe(401);
    expect(wrongPassword.body).toEqual(noAccount.body);
    expect(wrongPassword.body.error).toEqual({
      code: 'UNAUTHENTICATED',
      message: 'Email or password is incorrect.',
    });
  });

  it('does not set a cookie when sign in fails', async () => {
    const res = await signIn(app, 'axr101@case.edu', 'not the password');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('400s when the email or password is missing', async () => {
    const res = await request(app).post('/api/session').set(CLIENT).send({ email: 'axr101@case.edu' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('turns away a request without the client header', async () => {
    const res = await request(app).post('/api/session').send({ email: 'axr101@case.edu', password: DEMO_PASSWORD });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('slows down guessing: 10 wrong tries and the next one is blocked', async () => {
    const limited = createApp(); // fresh app = fresh counter
    for (let i = 0; i < 10; i++) {
      expect((await signIn(limited, 'axr101@case.edu', 'wrong')).status).toBe(401);
    }
    const res = await signIn(limited, 'axr101@case.edu', DEMO_PASSWORD);
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
  });

  it('does not count successful sign ins against the limit', async () => {
    const limited = createApp();
    for (let i = 0; i < 12; i++) {
      expect((await signIn(limited, 'axr101@case.edu', DEMO_PASSWORD)).status).toBe(200);
    }
  });
});

describe('using the session', () => {
  const app = createApp();

  it('lets a signed in student call the api with the cookie from sign in', async () => {
    const login = await signIn(app, 'axr101@case.edu', DEMO_PASSWORD);
    const res = await request(app).get('/api/courses/1/candidates').set('Cookie', sessionCookie(login));
    expect(res.status).toBe(200);
  });

  it('uses the student in the cookie, not one named in a header', async () => {
    // signed in as 101, claiming to be 102 in the old demo header
    const res = await request(app)
      .get('/api/me')
      .set('Cookie', `${COOKIE_NAME}=${createToken('101')}`)
      .set('X-Student-Id', '102');
    expect(res.body.studentId).toBe('101');
  });

  it('401s with no cookie, and the old demo header does not count', async () => {
    const none = await request(app).get('/api/me');
    expect(none.status).toBe(401);
    const header = await request(app).get('/api/me').set('X-Student-Id', '101');
    expect(header.status).toBe(401);
  });

  it('401s on an expired cookie', async () => {
    const old = createToken('101', Date.now() - 9 * 60 * 60 * 1000);
    const res = await request(app).get('/api/me').set('Cookie', `${COOKIE_NAME}=${old}`);
    expect(res.status).toBe(401);
  });

  it('401s on a cookie someone made up', async () => {
    const res = await request(app).get('/api/me').set('Cookie', `${COOKIE_NAME}=eyJzaWQiOiIxMDEifQ.fake`);
    expect(res.status).toBe(401);
  });

  it('401s on a valid cookie for a student that no longer exists', async () => {
    const res = await request(app).get('/api/me').set('Cookie', `${COOKIE_NAME}=${createToken('424242')}`);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/me', () => {
  const app = createApp();

  it('gives the student and their courses', async () => {
    const res = await request(app).get('/api/me').set('Cookie', `${COOKIE_NAME}=${createToken('105')}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ studentId: '105', name: 'Elijah Ford', tutorialCompleted: false });
    expect(res.body.courses.map((c: { code: string }) => c.code)).toEqual(['SAMPLE 101', 'SAMPLE 102']);
  });

  it('never sends the password hash', async () => {
    const res = await request(app).get('/api/me').set('Cookie', `${COOKIE_NAME}=${createToken('105')}`);
    expect(JSON.stringify(res.body)).not.toMatch(/argon2|passwordHash/);
  });
});

describe('DELETE /api/session', () => {
  const app = createApp();

  it('clears the cookie', async () => {
    const res = await request(app).delete('/api/session').set(CLIENT);
    expect(res.status).toBe(204);
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_NAME}=`))!;
    expect(cookie).toMatch(/Expires=Thu, 01 Jan 1970/);
  });

  it('turns away a request without the client header', async () => {
    const res = await request(app).delete('/api/session');
    expect(res.status).toBe(403);
  });
});

describe('PUT /api/me/password', () => {
  const app = createApp();
  const CLIENT_HEADER = { 'X-Requested-With': 'CaseStudy' };

  // changes a password, so with a db it needs its own student
  let email = 'bxc102@case.edu';
  let studentId = '102';

  beforeAll(async () => {
    if (config.useMockData) return;
    email = `pwtest${Date.now()}@test.edu`;
    const row = await prisma.student.create({ data: { name: 'Pw Test', schoolEmail: email, passwordHash: await hashPassword(DEMO_PASSWORD) } });
    studentId = row.id.toString();
  });

  afterAll(async () => {
    if (!config.useMockData) await prisma.student.delete({ where: { id: BigInt(studentId) } });
  });

  const cookie = () => `${COOKIE_NAME}=${createToken(studentId)}`;
  const change = (body: object) =>
    request(app).put('/api/me/password').set(CLIENT_HEADER).set('Cookie', cookie()).send(body);

  it('changes the password so the new one signs in and the old one does not', async () => {
    const res = await change({ currentPassword: DEMO_PASSWORD, newPassword: 'a better password' });
    expect(res.status).toBe(204);

    expect((await signIn(app, email, 'a better password')).status).toBe(200);
    expect((await signIn(app, email, DEMO_PASSWORD)).status).toBe(401);

    // and back to the demo password
    const back = await change({ currentPassword: 'a better password', newPassword: DEMO_PASSWORD });
    expect(back.status).toBe(204);
  });

  it('400s when the current password is wrong and changes nothing', async () => {
    const res = await change({ currentPassword: 'not it', newPassword: 'a better password' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
    expect((await signIn(app, email, DEMO_PASSWORD)).status).toBe(200);
  });

  it('400s on a new password under 8 characters', async () => {
    const res = await change({ currentPassword: DEMO_PASSWORD, newPassword: 'short' });
    expect(res.status).toBe(400);
  });

  it('400s when the new password is the same as the old one', async () => {
    const res = await change({ currentPassword: DEMO_PASSWORD, newPassword: DEMO_PASSWORD });
    expect(res.status).toBe(400);
  });

  it('needs a session and the client header', async () => {
    const noSession = await request(app).put('/api/me/password').set(CLIENT_HEADER).send({ currentPassword: 'x', newPassword: 'long enough' });
    expect(noSession.status).toBe(401);
    const noHeader = await request(app).put('/api/me/password').set('Cookie', cookie()).send({ currentPassword: DEMO_PASSWORD, newPassword: 'long enough' });
    expect(noHeader.status).toBe(403);
  });

  it('401s for a valid cookie of a student that does not exist', async () => {
    const res = await request(app)
      .put('/api/me/password')
      .set(CLIENT_HEADER)
      .set('Cookie', `${COOKIE_NAME}=${createToken('424242')}`)
      .send({ currentPassword: 'x', newPassword: 'long enough' });
    expect(res.status).toBe(401);
  });
});
