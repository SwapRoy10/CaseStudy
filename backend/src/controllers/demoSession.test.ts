import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { COOKIE_NAME } from '../auth/sessionToken';

// the demo sign in is how someone picks a name from the demo roster and gets a
// session without a password. it has to work for the demo and be gone in production.

const CLIENT = { 'X-Requested-With': 'CaseStudy' };
const app = createApp();

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('POST /api/demo/session', () => {
  it('signs in as the picked student, with a cookie that works', async () => {
    const res = await request(app).post('/api/demo/session').set(CLIENT).send({ studentId: '101' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ studentId: '101', tutorialCompleted: false });

    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith(`${COOKIE_NAME}=`))!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');

    const me = await request(app).get('/api/me').set('Cookie', cookie.split(';')[0]);
    expect(me.body.studentId).toBe('101');
  });

  it('works for every student on the demo roster', async () => {
    const roster = await request(app).get('/api/demo/roster');
    const csds = roster.body.courses.find((c: { code: string }) => c.code === 'CSDS 393');
    for (const student of csds.students.slice(0, 5)) {
      const res = await request(app).post('/api/demo/session').set(CLIENT).send({ studentId: student.id });
      expect(res.status).toBe(200);
      expect(res.body.studentId).toBe(student.id);
    }
  });

  it('404s for a student that does not exist', async () => {
    const res = await request(app).post('/api/demo/session').set(CLIENT).send({ studentId: '424242' });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('400s on an id that is not a number or is missing', async () => {
    const bad = await request(app).post('/api/demo/session').set(CLIENT).send({ studentId: 'abc' });
    expect(bad.status).toBe(400);
    const missing = await request(app).post('/api/demo/session').set(CLIENT).send({});
    expect(missing.status).toBe(400);
  });

  it('turns away a request without the client header', async () => {
    const res = await request(app).post('/api/demo/session').send({ studentId: '101' });
    expect(res.status).toBe(403);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});

describe('in production', () => {
  it('has no demo roster and no demo sign in, so everyone needs a password', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SESSION_SECRET', 'x'.repeat(32));
    vi.stubEnv('LOG_LEVEL', 'silent');
    vi.resetModules();
    const { createApp: createProductionApp } = await import('../app.js');
    const prod = createProductionApp();

    // the routes don't exist, so nobody gets in without a session
    const roster = await request(prod).get('/api/demo/roster');
    expect(roster.status).toBe(401);
    expect(roster.body.courses).toBeUndefined();
    const res = await request(prod).post('/api/demo/session').set(CLIENT).send({ studentId: '101' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();

    // even signed in, they are simply not there
    const { createToken } = await import('../auth/sessionToken.js');
    const cookie = `${COOKIE_NAME}=${createToken('101')}`;
    expect((await request(prod).get('/api/demo/roster').set('Cookie', cookie)).status).toBe(404);
    expect((await request(prod).post('/api/demo/session').set(CLIENT).set('Cookie', cookie).send({ studentId: '102' })).status).toBe(404);

    // password sign in still works there
    const login = await request(prod).post('/api/session').set(CLIENT).send({ email: 'axr101@case.edu', password: 'casestudy123' });
    expect(login.status).toBe(200);
  });
});

describe('with DEMO_ROUTES=false', () => {
  it('has no demo routes even outside production', async () => {
    vi.stubEnv('DEMO_ROUTES', 'false');
    vi.stubEnv('LOG_LEVEL', 'silent');
    vi.resetModules();
    const { createApp: createOffApp } = await import('../app.js');
    const off = createOffApp();

    const res = await request(off).post('/api/demo/session').set(CLIENT).send({ studentId: '101' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
    expect((await request(off).get('/api/demo/roster')).status).toBe(401);
  });
});
