// collaborative code by somesh and claude sonnet 5.5

import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app';
import { COOKIE_NAME, createToken } from './auth/sessionToken';
import { config } from './config';
import { resetStore } from './memory/store';
import { REVIEW_CRITERIA } from './reviews/criteria';

// demo with no DATABASE_URL, same flow as groupFlow.test.ts on the memory store

const app = createApp();
const CLIENT = { 'X-Requested-With': 'CaseStudy' };
const as = (id: string) => ({ Cookie: `${COOKIE_NAME}=${createToken(id)}` });
const post = (url: string, who: string, body: object = {}) => request(app).post(url).set(CLIENT).set(as(who)).send(body);
const get = (url: string, who: string) => request(app).get(url).set(as(who));

describe.skipIf(!config.useMockData)('the demo without a database', () => {
  beforeAll(() => resetStore());

  let requestId: string;
  let groupId: string;

  it('matching still works, and a profile saved now changes the next list', async () => {
    // 108 has no profile yet, so nobody sees them
    const before = await get('/api/courses/1/candidates', '101');
    expect(before.body.candidates.map((c: { candidateId: string }) => c.candidateId)).not.toContain('108');

    const saved = await request(app)
      .put('/api/courses/1/profile')
      .set(CLIENT)
      .set(as('108'))
      .send({ gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [{ weekday: 1, startMinute: 540, endMinute: 660 }] });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ gradeGoal: 'A_TRACK', reviewAverage: null });

    const after = await get('/api/courses/1/candidates', '101');
    expect(after.body.candidates.map((c: { candidateId: string }) => c.candidateId)).toContain('108');
  });

  it('a profile that is not saved is null, and a bad save names the fields', async () => {
    expect((await get('/api/courses/2/profile', '105')).text).toBe('null');
    const bad = await request(app).put('/api/courses/1/profile').set(CLIENT).set(as('108')).send({});
    expect(bad.status).toBe(400);
    expect(bad.body.error.fields.sort()).toEqual(['blocks', 'gradeGoal', 'workStyle']);
  });

  it('sends a request, with the same errors as the database', async () => {
    const sent = await post('/api/courses/1/requests', '101', { recipientId: '102' });
    expect(sent.status).toBe(201);
    requestId = sent.body.requestId;

    const again = await post('/api/courses/1/requests', '101', { recipientId: '102' });
    expect(again.status).toBe(409);
    expect(again.body.error.reason).toBe('DUPLICATE_REQUEST');
    const far = await post('/api/courses/1/requests', '101', { recipientId: '104' });
    expect(far.body.error.reason).toBe('NO_LONGER_ELIGIBLE');
  });

  it('shows it to both, hides the full profile, and only the recipient can answer', async () => {
    const theirs = await get('/api/courses/1/requests', '102');
    expect(theirs.body.requests[0]).toMatchObject({ requestId, status: 'PENDING' });
    expect(theirs.body.requests[0].other.candidateId).toBe('101');
    expect(JSON.stringify(theirs.body)).not.toMatch(/Alex|@case\.edu/);

    expect((await get('/api/courses/1/members/102', '101')).status).toBe(403);
    expect((await post(`/api/requests/${requestId}/response`, '101', { decision: 'ACCEPT' })).status).toBe(403);
  });

  it('forms a group when 102 accepts, and unlocks the full profile', async () => {
    const res = await post(`/api/requests/${requestId}/response`, '102', { decision: 'ACCEPT' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACCEPTED');

    const group = await get('/api/courses/1/group', '101');
    expect(group.body.group.members.map((m: { studentId: string }) => m.studentId)).toEqual(['101', '102']);
    expect(group.body.group.criteria).toEqual(REVIEW_CRITERIA);
    groupId = group.body.group.groupId;

    const profile = await get('/api/courses/1/members/102', '101');
    expect(profile.status).toBe(200);
    expect(profile.body).toMatchObject({ name: 'Brianna Cole', schoolEmail: 'bxc102@case.edu' });
  });

  it('takes a review once, with the average back', async () => {
    const ratings = REVIEW_CRITERIA.map((criteriaName) => ({ criteriaName, rating: 5 }));
    const res = await post(`/api/groups/${groupId}/reviews`, '101', { revieweeId: '102', ratings });
    expect(res.status).toBe(201);
    expect(res.body.revieweeAverage).toBeCloseTo(63 / 18, 10);

    const again = await post(`/api/groups/${groupId}/reviews`, '101', { revieweeId: '102', ratings });
    expect(again.status).toBe(409);
    expect(again.body.error.reason).toBe('DUPLICATE_REVIEW');
  });

  it('shows the new average on the candidate card too', async () => {
    const mine = await get('/api/courses/1/candidates', '101');
    const card = mine.body.candidates.find((c: { candidateId: string }) => c.candidateId === '102');
    expect(card.reviewAverage).toBeCloseTo(63 / 18, 10);
  });

  it('cancel and decline work too', async () => {
    const sent = await post('/api/courses/1/requests', '103', { recipientId: '101' });
    expect((await post(`/api/requests/${sent.body.requestId}/cancel`, '103')).body.status).toBe('CANCELED');
    const second = await post('/api/courses/1/requests', '103', { recipientId: '101' });
    expect((await post(`/api/requests/${second.body.requestId}/response`, '101', { decision: 'DECLINE' })).body.status).toBe('DECLINED');
  });

  it('does not answer 503 any more', async () => {
    const res = await post('/api/courses/1/requests', '106', { recipientId: '101' });
    expect(res.status).toBe(201);
  });
});
