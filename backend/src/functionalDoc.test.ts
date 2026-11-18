import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { COOKIE_NAME, createToken } from './auth/sessionToken';
import { config } from './config';
import { resetStore, store } from './memory/store';
import { REVIEW_CRITERIA } from './reviews/criteria';

// test cases from the functional testing doc, sections 5.1 to 5.4 and 5.7
// (user, profile, availability block, course and enrollment, group). each test
// has the doc's test id in its name. they run on the course 1 sample data,
// students 101 to 108 (figure 1), on the in memory store. they run in the mock
// project in vitest.config.mts, so ci runs them too even though it has a
// database. the store is reset before every test, so each one starts from the
// sample data like the doc says.
//
// screen tests (USER-1 to 3, TUT-1 to 3, PROF-9, PROF-10, BLK-2, BLK-6, CRS-4,
// GRP-6, GRP-7) are checked by hand. CRS-5, CRS-6 and CRS-7 need the roster
// import and are covered in enrollment/enrollment.service.test.ts and roster.test.ts.

const app = createApp();
const CLIENT = { 'X-Requested-With': 'CaseStudy' };
const as = (id: string) => ({ Cookie: `${COOKIE_NAME}=${createToken(id)}` });
const get = (url: string, who: string) => request(app).get(url).set(as(who));
const post = (url: string, who: string, body: object = {}) => request(app).post(url).set(CLIENT).set(as(who)).send(body);
const put = (url: string, who: string, body: object) => request(app).put(url).set(CLIENT).set(as(who)).send(body);

// minutes from midnight, so h(9) is 9:00
const h = (hour: number) => hour * 60;
const block = (weekday: number, from: number, to: number) => ({ weekday, startMinute: h(from), endMinute: h(to) });
const SUN = 0, MON = 1, TUE = 2, WED = 3, SAT = 6;

// 101's saved profile in the sample data
const profile101 = { gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [block(MON, 9, 11), block(WED, 13, 15)] };

const ids = (res: request.Response) => res.body.candidates.map((c: { candidateId: string }) => c.candidateId);

// sends a request and has the recipient accept it
async function accept(from: string, to: string) {
  const sent = await post('/api/courses/1/requests', from, { recipientId: to });
  expect(sent.status).toBe(201);
  const answer = await post(`/api/requests/${sent.body.requestId}/response`, to, { decision: 'ACCEPT' });
  expect(answer.status).toBe(200);
}

describe.skipIf(!config.useMockData)('functional testing doc, sections 5.1 to 5.4 and 5.7', () => {
  beforeEach(() => resetStore());

  describe('5.1 user', () => {
    it('TUT-4: only the signed in student can set their own tutorial flag, and twice is harmless', async () => {
      const noSession = await request(app).post('/api/me/tutorial-complete').set(CLIENT);
      expect(noSession.status).toBe(401);
      expect(noSession.body.error.message).toBe('Sign in to continue.');

      expect((await post('/api/me/tutorial-complete', '104', { studentId: '105' })).status).toBe(204);
      expect((await post('/api/me/tutorial-complete', '104')).status).toBe(204);

      expect((await get('/api/me', '104')).body.tutorialCompleted).toBe(true);
      expect((await get('/api/me', '105')).body.tutorialCompleted).toBe(false);
    });
  });

  describe('5.2 profile', () => {
    it('PROF-1: a student can open their own profile, with their review average', async () => {
      const mine = await get('/api/courses/1/profile', '102');
      expect(mine.status).toBe(200);
      expect(mine.body).toMatchObject({
        gradeGoal: 'A_TRACK',
        workStyle: 'GROUP',
        blocks: [block(MON, 10, 12), block(WED, 14, 16)],
        name: 'Brianna Cole',
        schoolEmail: 'bxc102@case.edu',
        reviewAverage: 3.2,
      });

      const unrated = await get('/api/courses/1/profile', '106');
      expect(unrated.status).toBe(200);
      expect(unrated.body.reviewAverage).toBeNull();
    });

    it('PROF-2: a student with no profile gets null, not an error', async () => {
      const res = await get('/api/courses/1/profile', '108');
      expect(res.status).toBe(200);
      expect(res.text).toBe('null');
    });

    it('PROF-3: a first save creates the profile, and the next matching run uses it', async () => {
      const first = { gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [block(MON, 10, 11)] };
      const saved = await put('/api/courses/1/profile', '108', first);
      expect(saved.status).toBe(200);
      expect(saved.body).toMatchObject(first);
      expect((await get('/api/courses/1/profile', '108')).body).toMatchObject(first);

      const list = await get('/api/courses/1/candidates', '101');
      const order = ids(list);
      expect(order[0]).toBe('102');
      expect(order.slice(1, 3).sort()).toEqual(['106', '108']);
      expect(order[3]).toBe('103');
      const card = list.body.candidates.find((c: { candidateId: string }) => c.candidateId === '108');
      expect(card.sharedIntervals).toEqual([block(MON, 10, 11)]);
    });

    it('PROF-4: each save replaces the old values', async () => {
      expect((await put('/api/courses/1/profile', '101', { ...profile101, workStyle: 'SOLO' })).status).toBe(200);
      const first = await get('/api/courses/1/profile', '101');
      expect(first.body).toMatchObject({ gradeGoal: 'A_TRACK', workStyle: 'SOLO', blocks: profile101.blocks });

      expect((await put('/api/courses/1/profile', '101', { ...profile101, gradeGoal: 'PASS_TRACK', workStyle: 'SOLO' })).status).toBe(200);
      const second = await get('/api/courses/1/profile', '101');
      expect(second.body).toMatchObject({ gradeGoal: 'PASS_TRACK', workStyle: 'SOLO' });
    });

    it('PROF-5: a student id in the url or the body is ignored', async () => {
      const res = await put('/api/courses/1/profile?studentId=102', '101', { ...profile101, studentId: '102', workStyle: 'SOLO' });
      expect(res.status).toBe(200);
      expect((await get('/api/courses/1/profile', '101')).body.workStyle).toBe('SOLO');
      expect((await get('/api/courses/1/profile', '102')).body.workStyle).toBe('GROUP');
    });

    it('PROF-6: a save with missing fields names every one and changes nothing', async () => {
      const noGoal = await put('/api/courses/1/profile', '101', { workStyle: 'GROUP', blocks: profile101.blocks });
      expect(noGoal.status).toBe(400);
      expect(noGoal.body.error.code).toBe('VALIDATION');
      expect(noGoal.body.error.fields).toEqual(['gradeGoal']);

      const noStyleNoBlocks = await put('/api/courses/1/profile', '101', { gradeGoal: 'A_TRACK' });
      expect(noStyleNoBlocks.status).toBe(400);
      expect(noStyleNoBlocks.body.error.fields.sort()).toEqual(['blocks', 'workStyle']);

      const emptyBlocks = await put('/api/courses/1/profile', '101', { gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [] });
      expect(emptyBlocks.status).toBe(400);
      expect(emptyBlocks.body.error.fields).toEqual(['blocks']);

      expect((await get('/api/courses/1/profile', '101')).body).toMatchObject(profile101);
    });

    it('PROF-7: only the two grade goals and the two work styles are accepted', async () => {
      for (const [bad, field] of [
        [{ gradeGoal: 'B_TRACK' }, 'gradeGoal'],
        [{ gradeGoal: 'a_track' }, 'gradeGoal'],
        [{ workStyle: 'PAIR' }, 'workStyle'],
      ] as const) {
        const res = await put('/api/courses/1/profile', '101', { ...profile101, ...bad });
        expect(res.status).toBe(400);
        expect(res.body.error.fields).toContain(field);
      }
      expect((await get('/api/courses/1/profile', '101')).body).toMatchObject(profile101);

      for (const gradeGoal of ['A_TRACK', 'PASS_TRACK']) {
        for (const workStyle of ['SOLO', 'GROUP']) {
          expect((await put('/api/courses/1/profile', '101', { ...profile101, gradeGoal, workStyle })).status).toBe(200);
          expect((await get('/api/courses/1/profile', '101')).body).toMatchObject({ gradeGoal, workStyle });
        }
      }
    });

    it('PROF-8: a student can not open or save a profile in a course they are not on', async () => {
      const read = await get('/api/courses/2/profile', '101');
      expect(read.status).toBe(409);
      expect(read.body.error.reason).toBe('NOT_ENROLLED');

      const save = await put('/api/courses/2/profile', '101', profile101);
      expect(save.status).toBe(409);
      expect(save.body.error.reason).toBe('NOT_ENROLLED');

      expect(store.profiles.some((p) => p.studentId === '101' && p.courseId === '2')).toBe(false);
      expect((await get('/api/courses/1/profile', '101')).body).toMatchObject(profile101);
    });
  });

  describe('5.3 availability block', () => {
    it('BLK-1: several blocks a day, and the first and last minutes of the week', async () => {
      const blocks = [block(SUN, 0, 1), block(MON, 9, 10), block(MON, 13, 14), block(SAT, 23, 24)];
      const saved = await put('/api/courses/1/profile', '101', { ...profile101, blocks });
      expect(saved.status).toBe(200);
      expect(saved.body.blocks).toEqual(blocks);
      expect((await get('/api/courses/1/profile', '101')).body.blocks).toEqual(blocks);
    });

    it('BLK-3: one bad block stops the whole save', async () => {
      const good = block(MON, 9, 10);
      const badBlocks = [
        { weekday: 7, startMinute: 600, endMinute: 660 },
        { weekday: -1, startMinute: 600, endMinute: 660 },
        { weekday: MON, startMinute: -1, endMinute: 60 },
        { weekday: MON, startMinute: 600, endMinute: 1441 },
        { weekday: MON, startMinute: 600, endMinute: 600 },
        { weekday: MON, startMinute: 600.5, endMinute: 660 },
      ];
      for (const bad of badBlocks) {
        const res = await put('/api/courses/1/profile', '101', { ...profile101, blocks: [good, bad] });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe('VALIDATION');
        expect(res.body.error.fields.every((f: string) => f.startsWith('blocks'))).toBe(true);
      }
      // nothing was saved, not even the good block
      expect((await get('/api/courses/1/profile', '101')).body.blocks).toEqual(profile101.blocks);
    });

    it('BLK-4: overlapping or repeated blocks on the same day are merged', async () => {
      const blocks = [block(MON, 9, 11), block(MON, 10, 12), block(MON, 13, 14), block(MON, 13, 14), block(TUE, 10, 12)];
      const merged = [block(MON, 9, 12), block(MON, 13, 14), block(TUE, 10, 12)];
      const saved = await put('/api/courses/1/profile', '101', { ...profile101, blocks });
      expect(saved.body.blocks).toEqual(merged);
      expect((await get('/api/courses/1/profile', '101')).body.blocks).toEqual(merged);
    });

    it('BLK-5: a save replaces every block, and the next matching run uses the new ones', async () => {
      expect((await put('/api/courses/1/profile', '101', { ...profile101, blocks: [block(WED, 13, 15)] })).status).toBe(200);
      expect((await get('/api/courses/1/profile', '101')).body.blocks).toEqual([block(WED, 13, 15)]);

      const order = ids(await get('/api/courses/1/candidates', '101'));
      expect(order.sort()).toEqual(['102', '106']);
    });
  });

  describe('5.3 availability block, past midnight', () => {
    it('BLK-7: a block that ends before it starts is split at midnight, and Saturday wraps to Sunday', async () => {
      const mon = await put('/api/courses/1/profile', '101', { ...profile101, blocks: [{ weekday: MON, startMinute: h(23), endMinute: h(1) }] });
      expect(mon.status).toBe(200);
      expect(mon.body.blocks).toEqual([block(MON, 23, 24), block(TUE, 0, 1)]);
      expect((await get('/api/courses/1/profile', '101')).body.blocks).toEqual([block(MON, 23, 24), block(TUE, 0, 1)]);

      const sat = await put('/api/courses/1/profile', '101', { ...profile101, blocks: [{ weekday: SAT, startMinute: h(23), endMinute: h(1) }] });
      expect(sat.status).toBe(200);
      expect(sat.body.blocks).toEqual([block(SUN, 0, 1), block(SAT, 23, 24)]);
    });
  });

  describe('5.4 course and enrollment', () => {
    it('CRS-1: the course list shows this term, and being on it does not mean enrolled', async () => {
      const list = await get('/api/courses', '101');
      expect(list.status).toBe(200);
      const courseIds = list.body.courses.map((c: { courseId: string }) => c.courseId);
      expect(courseIds).toEqual(expect.arrayContaining(['1', '2']));
      for (const course of list.body.courses) expect(course).toMatchObject({ code: expect.any(String), section: expect.any(String), term: expect.any(String) });

      const notOnIt = await get('/api/courses/2/profile', '101');
      expect(notOnIt.status).toBe(409);
      expect(notOnIt.body.error.reason).toBe('NOT_ENROLLED');
    });

    // the doc also adds 101 to course 2 through the roster import and reads the
    // profile again. the import needs a database, so that step is in
    // enrollment.service.test.ts
    it('CRS-2: the roster is checked on every course route', async () => {
      const routes = ['profile', 'candidates', 'requests', 'group'];
      for (const route of routes) {
        expect((await get(`/api/courses/1/${route}`, '101')).status).toBe(200);
      }
      for (const route of routes) {
        const res = await get(`/api/courses/2/${route}`, '101');
        expect(res.status).toBe(409);
        expect(res.body.error.reason).toBe('NOT_ENROLLED');
      }
      const save = await put('/api/courses/2/profile', '101', profile101);
      expect(save.status).toBe(409);
      expect(save.body.error.reason).toBe('NOT_ENROLLED');
    });

    it('CRS-3: a course id that is not a whole number is refused first', async () => {
      const abc = await get('/api/courses/abc/profile', '101');
      expect(abc.status).toBe(400);
      expect(abc.body.error.code).toBe('VALIDATION');
      expect(abc.body.error.message).toContain('courseId');

      const decimal = await put('/api/courses/1.5/profile', '101', profile101);
      expect(decimal.status).toBe(400);
      expect(decimal.body.error.message).toContain('courseId');
    });
  });

  describe('5.7 group', () => {
    it('GRP-1: no group gives null, and an accepted request makes one both students see', async () => {
      const before = await get('/api/courses/1/group', '101');
      expect(before.status).toBe(200);
      expect(before.body.group).toBeNull();

      await accept('101', '102');
      const mine = (await get('/api/courses/1/group', '101')).body.group;
      const theirs = (await get('/api/courses/1/group', '102')).body.group;
      expect(mine.groupId).toBe(theirs.groupId);
      expect(mine.courseId).toBe('1');
      expect(mine.formedAt).toEqual(expect.any(String));
      expect(mine.members.map((m: { studentId: string }) => m.studentId)).toEqual(['101', '102']);
      expect(mine.members.map((m: { name: string }) => m.name)).toEqual(['Alex Rivera', 'Brianna Cole']);
      expect(mine.criteria).toEqual(REVIEW_CRITERIA);
      expect(mine.members.some((m: { reviewedByMe: boolean }) => m.reviewedByMe)).toBe(false);
    });

    it('GRP-2: a student who is not in the group can not use its peer review', async () => {
      await accept('101', '102');
      await accept('106', '101');
      const groupId = (await get('/api/courses/1/group', '101')).body.group.groupId;

      expect((await get('/api/courses/1/group', '103')).body.group).toBeNull();
      const ratings = REVIEW_CRITERIA.map((criteriaName) => ({ criteriaName, rating: 4 }));
      const review = await post(`/api/groups/${groupId}/reviews`, '103', { revieweeId: '102', ratings });
      expect(review.status).toBe(403);
    });

    it('GRP-3: when someone joins, everyone sees the same group', async () => {
      await accept('101', '102');
      const formed = (await get('/api/courses/1/group', '101')).body.group;

      await accept('106', '101');
      for (const who of ['101', '102', '106']) {
        const group = (await get('/api/courses/1/group', who)).body.group;
        expect(group.groupId).toBe(formed.groupId);
        expect(group.members.map((m: { studentId: string }) => m.studentId)).toEqual(['101', '102', '106']);
        expect(group.formedAt).toBe(formed.formedAt);
      }
    });

    it('GRP-4: a matched member can see the full profile, someone outside can not', async () => {
      await accept('101', '102');
      const full = await get('/api/courses/1/members/102', '101');
      expect(full.status).toBe(200);
      expect(full.body).toMatchObject({
        name: 'Brianna Cole',
        schoolEmail: 'bxc102@case.edu',
        blocks: [block(MON, 10, 12), block(WED, 14, 16)],
        gradeGoal: 'A_TRACK',
        workStyle: 'GROUP',
        reviewAverage: 3.2,
      });
      expect((await get('/api/courses/1/members/101', '103')).status).toBe(403);
    });

    it('GRP-5: a group belongs to one course and never shows up in another', async () => {
      await accept('101', '102');
      expect((await get('/api/courses/1/group', '101')).body.group).not.toBeNull();

      const other = await get('/api/courses/2/group', '101');
      expect(other.status).toBe(409);
      expect(other.body.error.reason).toBe('NOT_ENROLLED');
      expect(other.body.group).toBeUndefined();

      const abc = await get('/api/courses/abc/group', '101');
      expect(abc.status).toBe(400);
      expect(abc.body.error.code).toBe('VALIDATION');
    });

    it('GRP-8: two members who joined through a third can not open each other\'s full profile', async () => {
      await accept('101', '102');
      await accept('106', '101');
      expect((await get('/api/courses/1/members/106', '102')).status).toBe(403);
      expect((await get('/api/courses/1/members/102', '106')).status).toBe(403);
    });
  });
});
