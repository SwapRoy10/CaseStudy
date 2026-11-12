import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { config } from '../config';
import { rosterFromDatabase, rosterFromSampleData } from './demo.controller';

// the demo roster comes from postgres when there's a database and from
// sampleData.ts when there isn't. both should give the same answer, so these
// checks run either way.

const app = createApp();

describe('GET /api/demo/roster', () => {
  it('works without signing in, since it is how you pick who to sign in as', async () => {
    const res = await request(app).get('/api/demo/roster');
    expect(res.status).toBe(200);
  });

  it('lists the courses that have profiles, and skips past semesters', async () => {
    const res = await request(app).get('/api/demo/roster');
    // other database tests make their own courses while this runs, so only look
    // at the five seeded ones. 4 and 5 are past semesters with no profiles
    const seeded = res.body.courses.filter((c: { id: string }) => ['1', '2', '3', '4', '5'].includes(c.id));
    expect(seeded.map((c: { code: string }) => c.code)).toEqual(['SAMPLE 101', 'SAMPLE 102', 'CSDS 393']);
  });

  it('has the full csds 393 roster, including the two people with no profile yet', async () => {
    const res = await request(app).get('/api/demo/roster');
    const csds393 = res.body.courses.find((c: { code: string }) => c.code === 'CSDS 393');
    expect(csds393.title).toBe('Software Engineering');
    expect(csds393.students).toHaveLength(36);

    const noProfile = csds393.students.filter((s: { hasProfile: boolean }) => !s.hasProfile);
    expect(noProfile.map((s: { name: string }) => s.name)).toEqual(['Amara Nwosu', 'Ben Hughes']);
  });

  it('keeps the sample course exactly as the testing doc has it, 101 to 108', async () => {
    const res = await request(app).get('/api/demo/roster');
    const sample = res.body.courses.find((c: { id: string }) => c.id === '1');
    expect(sample.students.map((s: { id: string }) => s.id)).toEqual(['101', '102', '103', '104', '105', '106', '107', '108']);
  });

  it('only gives names and ids, never emails', async () => {
    const res = await request(app).get('/api/demo/roster');
    expect(JSON.stringify(res.body)).not.toContain('@');
  });
});

// the whole point of sampleData.ts is that the mock and the database agree
describe.skipIf(config.useMockData)('demo roster with a database', () => {
  it('gives the same roster from postgres as from sampleData.ts', async () => {
    const seededIds = rosterFromSampleData().map((c) => c.id);
    const fromDb = (await rosterFromDatabase()).filter((c) => seededIds.includes(c.id));
    expect(fromDb).toEqual(rosterFromSampleData());
  });
});
