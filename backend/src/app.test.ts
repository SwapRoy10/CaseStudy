import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

// Lets one test simulate a failed db read without touching the mock data.
const dbDown = vi.hoisted(() => ({ on: false }));
vi.mock('./matching/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./matching/data')>();
  return {
    ...actual,
    getCourseProfiles: async (courseId: string) => {
      if (dbDown.on) throw new Error('connection refused');
      return actual.getCourseProfiles(courseId);
    },
  };
});

const app = createApp();
const asStudent = (id: string) => ({ 'X-Student-Id': id });

afterEach(() => {
  dbDown.on = false;
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('works without signing in', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('GET /api/courses/:courseId/candidates', () => {
  it('returns ranked candidates from the matching module', async () => {
    const res = await request(app).get('/api/courses/1/candidates').set(asStudent('101'));

    expect(res.status).toBe(200);
    expect(res.body.courseId).toBe('1');
    const ids = res.body.candidates.map((c: { candidateId: string }) => c.candidateId);
    // 102 has the most overlap with 101; 103 and 106 tie on 1 block.
    // 104 (other grade goal), 105 (no overlap), 107 (no availability) are filtered out.
    expect(ids[0]).toBe('102');
    expect([...ids].sort()).toEqual(['102', '103', '106']);
  });

  it('only sends the limited view fields', async () => {
    const res = await request(app).get('/api/courses/1/candidates').set(asStudent('101'));
    for (const c of res.body.candidates) {
      expect(Object.keys(c).sort()).toEqual(
        ['candidateId', 'gradeGoal', 'reviewAverage', 'sharedIntervals', 'workStyle'].sort()
      );
    }
  });

  it('401s without a signed-in student', async () => {
    const res = await request(app).get('/api/courses/1/candidates');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('400s on a non-numeric course id', async () => {
    const res = await request(app).get('/api/courses/abc/candidates').set(asStudent('101'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });

  it('maps NO_PROFILE to a 409 the UI can show', async () => {
    // 107 saved a profile but no availability
    const res = await request(app).get('/api/courses/1/candidates').set(asStudent('107'));
    expect(res.status).toBe(409);
    expect(res.body.error).toEqual({
      code: 'STATE_CONFLICT',
      reason: 'NO_PROFILE',
      message: 'Complete your profile to see matches.',
    });
  });

  it('maps a failed db read to 503 UNAVAILABLE without leaking details', async () => {
    dbDown.on = true;

    const res = await request(app).get('/api/courses/1/candidates').set(asStudent('101'));
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('UNAVAILABLE');
    expect(JSON.stringify(res.body)).not.toContain('connection refused');
  });
});

describe('security and logging middleware', () => {
  it('sets helmet security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('tags every response with a request id, reusing one sent by the client', async () => {
    const fresh = await request(app).get('/api/health');
    expect(fresh.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);

    const echoed = await request(app).get('/api/health').set('X-Request-Id', 'trace-123');
    expect(echoed.headers['x-request-id']).toBe('trace-123');
  });

  it('rate limits the API with the standard error shape, but never health checks', async () => {
    const limited = createApp(); // fresh app = fresh counter
    const max = 300; // RATE_LIMIT_MAX default
    for (let i = 0; i < max; i++) {
      await request(limited).get('/api/courses/1/candidates').set(asStudent('101'));
    }
    const res = await request(limited).get('/api/courses/1/candidates').set(asStudent('101'));
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');

    const health = await request(limited).get('/api/health');
    expect(health.status).toBe(200);
  });
});

describe('unknown routes and bad bodies', () => {
  it('404s with the standard error shape', async () => {
    const res = await request(app).get('/api/nope').set(asStudent('101'));
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('400s on malformed JSON', async () => {
    const res = await request(app)
      .post('/api/courses/1/candidates')
      .set(asStudent('101'))
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION');
  });
});
