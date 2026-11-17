import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

// the operator key has to be set before config.ts reads the environment
const KEY = vi.hoisted(() => {
  process.env.OPERATOR_KEY = 'test-operator-key-1234';
  return 'test-operator-key-1234';
});

// the database part is tested in enrollment.service.test.ts. here importRoster
// is faked so these tests are only about who can call the route and what comes back
const imported = vi.hoisted(() => ({ result: { ok: true as boolean, added: 2, total: 3, rows: [] as unknown[] }, calls: [] as unknown[][] }));
vi.mock('./enrollment/enrollment.service', () => ({
  importRosterWithReasons: async (...args: unknown[]) => {
    imported.calls.push(args);
    return imported.result;
  },
}));

import { createApp } from './app';
import { COOKIE_NAME, createToken } from './auth/sessionToken';

const app = createApp();
const URL = '/api/operator/courses/3/roster';
const FILE = 'Student,SIS Login ID\n"Rivera, Alex",axr101\n';

afterEach(() => {
  imported.result = { ok: true, added: 2, total: 3, rows: [] };
  imported.calls = [];
});

describe('POST /api/operator/courses/:courseId/roster', () => {
  it('imports the file with the operator key', async () => {
    const res = await request(app).post(URL).set('X-Operator-Key', KEY).set('Content-Type', 'text/csv').send(FILE);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enrolled: 3, added: 2 });
    // the course comes from the url and the file text is passed on untouched
    expect(imported.calls).toEqual([['3', FILE]]);
  });

  it('turns away a request with no key', async () => {
    const res = await request(app).post(URL).set('Content-Type', 'text/csv').send(FILE);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(imported.calls).toEqual([]);
  });

  it('turns away the wrong key', async () => {
    const res = await request(app).post(URL).set('X-Operator-Key', 'test-operator-key-9999').set('Content-Type', 'text/csv').send(FILE);
    expect(res.status).toBe(403);
    expect(imported.calls).toEqual([]);
  });

  it('turns away a signed in student', async () => {
    const res = await request(app)
      .post(URL)
      .set('Cookie', `${COOKIE_NAME}=${createToken('101')}`)
      .set('X-Requested-With', 'CaseStudy')
      .set('Content-Type', 'text/csv')
      .send(FILE);
    expect(res.status).toBe(403);
    expect(imported.calls).toEqual([]);
  });

  it('accepts the content type excel on windows uses for csv', async () => {
    const res = await request(app).post(URL).set('X-Operator-Key', KEY).set('Content-Type', 'application/vnd.ms-excel').send(FILE);
    expect(res.status).toBe(200);
  });

  it('400s when the file is empty', async () => {
    const res = await request(app).post(URL).set('X-Operator-Key', KEY).set('Content-Type', 'text/csv').send('   ');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'VALIDATION', fields: ['file'] });
  });

  it('400s when no file was sent as text', async () => {
    const res = await request(app).post(URL).set('X-Operator-Key', KEY).send({ not: 'a file' });
    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual(['file']);
  });

  it('400s on a course id that is not a number', async () => {
    const res = await request(app).post('/api/operator/courses/abc/roster').set('X-Operator-Key', KEY).set('Content-Type', 'text/csv').send(FILE);
    expect(res.status).toBe(400);
  });

  it('lists the bad rows and says nothing was imported', async () => {
    imported.result = { ok: false, added: 0, total: 0, rows: [{ row: 4, reason: 'no account for that email' }] };
    const res = await request(app).post(URL).set('X-Operator-Key', KEY).set('Content-Type', 'text/csv').send(FILE);
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: 'VALIDATION',
      message: 'Some rows could not be matched, so nothing was imported.',
      rows: [{ row: 4, reason: 'no account for that email' }],
    });
  });
});
