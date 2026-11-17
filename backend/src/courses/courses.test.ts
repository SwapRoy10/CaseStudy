import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { COOKIE_NAME, createToken } from '../auth/sessionToken';
import { currentTerm, listCourses } from './listCourses';

const app = createApp();
const signedIn = (id: string) => ({ Cookie: `${COOKIE_NAME}=${createToken(id)}` });

describe('listCourses', () => {
  it('gives the current term only, with its fields', async () => {
    const list = await listCourses();
    const seeded = list.filter((c) => ['1', '2', '3', '4', '5'].includes(c.courseId));
    // 4 and 5 are last spring
    expect(seeded.map((c) => c.code)).toEqual(['SAMPLE 101', 'SAMPLE 102', 'CSDS 393']);
    expect(seeded[2]).toEqual({
      courseId: '3',
      code: 'CSDS 393',
      title: 'Software Engineering',
      section: '100',
      term: 'Fall 2026',
    });
  });

  it('is the term currentTerm says', async () => {
    const term = await currentTerm();
    expect(term).toBe('Fall 2026');
    expect((await listCourses()).every((c) => c.term === term)).toBe(true);
  });
});

describe('GET /api/courses', () => {
  it('lists this term for any signed in student, even courses they are not on', async () => {
    // 101 is only on the first sample course but sees the whole term
    const res = await request(app).get('/api/courses').set(signedIn('101'));
    expect(res.status).toBe(200);
    expect(res.body.courses.map((c: { code: string }) => c.code)).toEqual(
      expect.arrayContaining(['SAMPLE 101', 'SAMPLE 102', 'CSDS 393'])
    );
    expect(res.body.courses.some((c: { code: string }) => c.code === 'CSDS 132')).toBe(false);
  });

  it('needs a signed in student', async () => {
    expect((await request(app).get('/api/courses')).status).toBe(401);
  });

  it('only sends course fields', async () => {
    const res = await request(app).get('/api/courses').set(signedIn('101'));
    for (const c of res.body.courses) {
      expect(Object.keys(c).sort()).toEqual(['code', 'courseId', 'section', 'term', 'title']);
    }
  });
});
