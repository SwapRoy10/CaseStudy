import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { hashPassword } from './auth/password';
import { COOKIE_NAME, createToken } from './auth/sessionToken';
import { config } from './config';
import { prisma } from './db';
import { makeClass } from './requests/testUtils';
import { DEMO_PASSWORD } from './sampleData';

// the profile routes and the first time tutorial, over http

const app = createApp();
const CLIENT = { 'X-Requested-With': 'CaseStudy' };
const as = (id: bigint | string) => ({ Cookie: `${COOKIE_NAME}=${createToken(id.toString())}` });

const goodProfile = {
  gradeGoal: 'A_TRACK',
  workStyle: 'GROUP',
  blocks: [
    { weekday: 1, startMinute: 540, endMinute: 660 },
    { weekday: 3, startMinute: 780, endMinute: 900 },
  ],
};

describe.skipIf(config.useMockData)('profile routes', () => {
  let course: string;
  let ids: bigint[];
  let cleanup: () => Promise<void>;
  // 0 has no profile yet, 1 is a classmate who is A track and free on monday morning
  const [me, mate] = [0, 1];

  beforeAll(async () => {
    const made = await makeClass(`pr${Date.now()}`, [{ blocks: null }, {}, { blocks: null }]);
    course = made.courseId.toString();
    ids = made.ids;
    cleanup = made.cleanup;
  });

  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  const put = (who: number, body: object, courseId = course) =>
    request(app).put(`/api/courses/${courseId}/profile`).set(CLIENT).set(as(ids[who])).send(body);
  const get = (who: number) => request(app).get(`/api/courses/${course}/profile`).set(as(ids[who]));

  it('is null while nothing is saved (sdd 6.3.2)', async () => {
    const res = await get(me);
    expect(res.status).toBe(200);
    expect(res.text).toBe('null');
  });

  it('reading the profile in a course the student is not on is 409 NOT_ENROLLED, not null', async () => {
    const res = await request(app).get('/api/courses/999999999/profile').set(as(ids[me]));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ reason: 'NOT_ENROLLED', message: 'Your enrollment in this class could not be verified.' });
  });

  it('can not see matches before there is a profile: 409 NO_PROFILE', async () => {
    const res = await request(app).get(`/api/courses/${course}/candidates`).set(as(ids[me]));
    expect(res.status).toBe(409);
    expect(res.body.error.reason).toBe('NO_PROFILE');
  });

  it('saves a profile and gives it back, with the name and email only they see here', async () => {
    const res = await put(me, goodProfile);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ...goodProfile, courseId: course, reviewAverage: null });
    expect(res.body.name).toContain('Student');
    expect(res.body.schoolEmail).toMatch(/@test\.edu$/);
    expect((await get(me)).body).toMatchObject(goodProfile);
  });

  it('is used by matching right away, with no restart (Profile.ApplyChanges)', async () => {
    const res = await request(app).get(`/api/courses/${course}/candidates`).set(as(ids[me]));
    expect(res.status).toBe(200);
    expect(res.body.candidates.map((c: { candidateId: string }) => c.candidateId)).toEqual([ids[mate].toString()]);
  });

  it('shows up for the classmate too once saved, and a change takes effect on the next call', async () => {
    const before = await request(app).get(`/api/courses/${course}/candidates`).set(as(ids[mate]));
    expect(before.body.candidates).toHaveLength(1);

    // me changes to pass track, so mate no longer matches
    await put(me, { ...goodProfile, gradeGoal: 'PASS_TRACK' });
    const after = await request(app).get(`/api/courses/${course}/candidates`).set(as(ids[mate]));
    expect(after.body.candidates).toEqual([]);
    await put(me, goodProfile);
  });

  it('replaces the whole availability on an edit instead of adding to it', async () => {
    await put(me, { ...goodProfile, blocks: [{ weekday: 5, startMinute: 600, endMinute: 660 }] });
    expect((await get(me)).body.blocks).toEqual([{ weekday: 5, startMinute: 600, endMinute: 660 }]);
    await put(me, goodProfile);
  });

  it('merges overlapping blocks and splits one that crosses midnight', async () => {
    const res = await put(2, {
      gradeGoal: 'A_TRACK',
      workStyle: 'SOLO',
      blocks: [
        { weekday: 1, startMinute: 540, endMinute: 600 },
        { weekday: 1, startMinute: 570, endMinute: 660 },
        { weekday: 6, startMinute: 1380, endMinute: 60 },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.blocks).toEqual([
      { weekday: 0, startMinute: 0, endMinute: 60 },
      { weekday: 1, startMinute: 540, endMinute: 660 },
      { weekday: 6, startMinute: 1380, endMinute: 1440 },
    ]);
  });

  describe('what is refused, and nothing changes', () => {
    it('a missing grade goal, work style or blocks: 400 naming every missing field', async () => {
      const res = await put(me, {});
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION');
      expect(res.body.error.fields.sort()).toEqual(['blocks', 'gradeGoal', 'workStyle']);
    });

    it('no availability at all', async () => {
      const res = await put(me, { ...goodProfile, blocks: [] });
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual(['blocks']);
    });

    it('a value that is not allowed', async () => {
      const res = await put(me, { ...goodProfile, gradeGoal: 'B_TRACK' });
      expect(res.status).toBe(400);
      expect(res.body.error.fields).toEqual(['gradeGoal']);
      const bad = await put(me, { ...goodProfile, blocks: [{ weekday: 9, startMinute: 540, endMinute: 600 }] });
      expect(bad.status).toBe(400);
    });

    it('leaves the saved profile as it was after a failed save', async () => {
      await put(me, { gradeGoal: 'PASS_TRACK', workStyle: 'SOLO', blocks: [] });
      expect((await get(me)).body).toMatchObject(goodProfile);
    });

    it('a course the student is not on the roster of: 409 NOT_ENROLLED', async () => {
      const other = await prisma.course.create({ data: { code: `pr-other${Date.now()}`, section: '001', term: 'Test' } });
      try {
        const res = await put(me, goodProfile, other.id.toString());
        expect(res.status).toBe(409);
        expect(res.body.error).toMatchObject({ reason: 'NOT_ENROLLED', message: 'Your enrollment in this class could not be verified.' });
        expect(await prisma.profile.count({ where: { courseId: other.id } })).toBe(0);
      } finally {
        await prisma.course.delete({ where: { id: other.id } });
      }
    });

    it('a course id that is not a number: 400', async () => {
      expect((await put(me, goodProfile, 'abc')).status).toBe(400);
    });
  });

  it('only ever saves the profile of the signed in student', async () => {
    // the body can say anything, the student comes from the cookie
    await put(2, { ...goodProfile, studentId: ids[me].toString() });
    expect(await prisma.profile.count({ where: { studentId: ids[me], courseId: BigInt(course) } })).toBe(1);
    expect((await get(2)).body.gradeGoal).toBe('A_TRACK');
  });
});

describe('first time tutorial', () => {
  // this changes a flag that stays saved, so with a database it gets a student of its own
  let studentId = '1035';
  beforeAll(async () => {
    if (config.useMockData) return;
    const row = await prisma.student.create({
      data: { name: 'Tutorial Test', schoolEmail: `tut${Date.now()}@test.edu`, passwordHash: await hashPassword(DEMO_PASSWORD) },
    });
    studentId = row.id.toString();
  });
  afterAll(async () => {
    if (!config.useMockData) await prisma.student.delete({ where: { id: BigInt(studentId) } });
  });

  it('starts false, and POST tutorial-complete makes it true for good', async () => {
    const before = await request(app).get('/api/me').set(as(studentId));
    expect(before.body.tutorialCompleted).toBe(false);

    const res = await request(app).post('/api/me/tutorial-complete').set(CLIENT).set(as(studentId));
    expect(res.status).toBe(204);

    const after = await request(app).get('/api/me').set(as(studentId));
    expect(after.body.tutorialCompleted).toBe(true);
  });

  it('is part of the sign in answer too', async () => {
    const email = config.useMockData ? 'axn1035@case.edu' : (await prisma.student.findUniqueOrThrow({ where: { id: BigInt(studentId) } })).schoolEmail;
    const res = await request(app).post('/api/session').set(CLIENT).send({ email, password: DEMO_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.tutorialCompleted).toBe(true);
  });

  it('is harmless to do twice', async () => {
    const res = await request(app).post('/api/me/tutorial-complete').set(CLIENT).set(as(studentId));
    expect(res.status).toBe(204);
  });
});
