import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from './app';
import { COOKIE_NAME, createToken } from './auth/sessionToken';
import { config } from './config';
import { prisma } from './db';
import { REVIEW_CRITERIA } from './reviews/criteria';
import { makeClass, match } from './requests/testUtils';

// test plan cases from 5.6 to 5.8 that the other test files don't check yet.
// each test name starts with its id in the functional testing doc.

const app = createApp();
const CLIENT = { 'X-Requested-With': 'CaseStudy' };
const as = (id: bigint) => ({ Cookie: `${COOKIE_NAME}=${createToken(id.toString())}` });
const rate = (rating: number) => REVIEW_CRITERIA.map((criteriaName) => ({ criteriaName, rating }));

// every key that appears anywhere in a response body
function keysIn(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysIn(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      keysIn(v, out);
    }
  }
  return out;
}

describe.skipIf(config.useMockData)('test plan cases not covered elsewhere', () => {
  // class one: me, plus three classmates who share 3, 2 and 1 availability
  // blocks with me, so the candidate order is fixed (Match.Rank.Overlap counts
  // blocks) and no tie is broken at random.
  // class two: a second course nobody from class one is on.
  let course: string;
  let otherCourse: string;
  let ids: bigint[];
  const cleanups: (() => Promise<void>)[] = [];
  const [me, most, middle, least] = [0, 1, 2, 3];

  beforeAll(async () => {
    const tag = `gap${Date.now()}`;
        const one = await makeClass(tag, [
      { blocks: [[1, 9, 11], [2, 9, 11], [3, 9, 11]] },
      { blocks: [[1, 9, 11], [2, 9, 11], [3, 9, 11]] },
      { blocks: [[1, 9, 11], [2, 9, 11]] },
      { blocks: [[1, 9, 11]] },
    ]);
    const two = await makeClass(`${tag}b`, [{}]);
    course = one.courseId.toString();
    otherCourse = two.courseId.toString();
    ids = one.ids;
    cleanups.push(one.cleanup, two.cleanup);
  });

  afterAll(async () => {
    for (const cleanup of cleanups) await cleanup();
    await prisma.$disconnect();
  });

  const post = (url: string, who: number, body?: object) =>
    request(app).post(url).set(CLIENT).set(as(ids[who])).send(body ?? {});
  const get = (url: string, who: number) => request(app).get(url).set(as(ids[who]));

  const candidateOrder = async () => {
    const res = await get(`/api/courses/${course}/candidates`, me);
    expect(res.status).toBe(200);
    const list = Array.isArray(res.body) ? res.body : res.body.candidates;
    return (list as any[]).map((c) => String(c.candidateId ?? c.studentId));
  };

  it('AVG-1: a student with no reviews has a null average, not 0', async () => {
    const res = await get(`/api/courses/${course}/profile`, me);
    expect(res.status).toBe(200);
    expect(res.body.reviewAverage).toBeNull();
  });

  it('REQ-8: status changes reach students in the app only, nothing sends email', () => {
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const mailer of ['nodemailer', '@sendgrid/mail', 'mailgun.js', 'postmark', 'resend']) {
      expect(deps).not.toContain(mailer);
    }
  });

  it('GRP-5: a group never shows up under a course the student is not on, and a bad id is a 400', async () => {
    const other = await get(`/api/courses/${otherCourse}/group`, me);
    expect(other.status).toBe(409);
    expect(JSON.stringify(other.body)).toContain('NOT_ENROLLED');

    const bad = await get('/api/courses/abc/group', me);
    expect(bad.status).toBe(400);
  });

  it('RESP-5: requests stay in their own course, another course is a 409 NOT_ENROLLED', async () => {
    const res = await get(`/api/courses/${otherCourse}/requests`, me);
    expect(res.status).toBe(409);
    expect(JSON.stringify(res.body)).toContain('NOT_ENROLLED');
  });

  it('AVG-4: a review changes the average but never the matching order', async () => {
    await match(BigInt(course), ids[most], ids[middle]);
    const before = await candidateOrder();
    expect(before.slice(0, 3)).toEqual([ids[most], ids[middle], ids[least]].map(String));

    const group = await get(`/api/courses/${course}/group`, most);
    expect(group.status).toBe(200);
    const res = await post(`/api/groups/${group.body.group.groupId}/reviews`, most, {
      revieweeId: ids[middle].toString(),
      ratings: rate(1),
    });
        expect(res.status, JSON.stringify(res.body)).toBe(201);

    expect(await candidateOrder()).toEqual(before);
    const profile = await get(`/api/courses/${course}/profile`, middle);
    expect(profile.body.reviewAverage).toBe(1);
  });

  it('AVG-3: only the average is shown, never single ratings or who gave them', async () => {
    // middle was reviewed in the test above
    const bodies = [
      (await get(`/api/courses/${course}/group`, middle)).body,
      (await get(`/api/courses/${course}/profile`, middle)).body,
      (await get(`/api/courses/${course}/candidates`, middle)).body,
    ];
    for (const body of bodies) {
      const keys = keysIn(body);
      for (const leak of ['rating', 'ratings', 'criteriaName', 'reviewId', 'reviewerId']) {
        expect(keys.has(leak), `a response includes "${leak}"`).toBe(false);
      }
    }
  });
});