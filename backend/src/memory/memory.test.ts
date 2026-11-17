import { beforeEach, describe, expect, it } from 'vitest';
import { ForbiddenError, StateConflictError, ValidationError } from '../errors';
import { getMatchedProfile, getGroup } from './groups';
import { getOwnProfile, saveProfile } from './profiles';
import { cancel, listRequests, respond, sendRequest } from './requests';
import { submitReview } from './reviews';
import { REVIEW_CRITERIA } from '../reviews/criteria';
import { getCourseProfiles, getAverages } from '../matching/mockData';
import { averageFor, resetStore, store } from './store';

// the in memory version of profiles, requests, groups and reviews. it has to give
// the same answers as the postgres services, so these follow the same cases as
// their tests. no database is used, so they run everywhere.
//
// course 1 from the testing doc: 101, 102 and 103 are A track and 101 shares time
// with both. 105, 107 and 108 are on the roster but 105 is free on friday only,
// 107 has no free time and 108 has no profile.

const goodProfile = { gradeGoal: 'A_TRACK', workStyle: 'GROUP', blocks: [{ weekday: 1, startMinute: 540, endMinute: 660 }] };
const rate = (rating: number) => REVIEW_CRITERIA.map((criteriaName) => ({ criteriaName, rating }));

beforeEach(() => resetStore());

// gives the students in the list the same monday morning so they all match each other
async function allMatch(ids: string[]) {
  for (const id of ids) await saveProfile(BigInt(id), '1', goodProfile);
}
const send = (from: string, to: string) => sendRequest(BigInt(from), '1', to);
const match = async (from: string, to: string) => respond(BigInt(to), (await send(from, to)).requestId, 'ACCEPT');

describe('the store', () => {
  it('starts as the sample data', () => {
    expect(store.profiles.find((p) => p.studentId === '101' && p.courseId === '1')?.gradeGoal).toBe('A_TRACK');
    expect(store.requests).toEqual([]);
    expect(averageFor('102')).toBeCloseTo(3.2, 10);
    expect(averageFor('103')).toBeCloseTo(4.9, 10);
    expect(averageFor('101')).toBeNull();
  });

  it('puts everything back on reset', async () => {
    await saveProfile(108n, '1', goodProfile);
    await allMatch(['101', '105']);
    await match('101', '105');
    resetStore();
    expect(store.requests).toEqual([]);
    expect(store.profiles.some((p) => p.studentId === '108' && p.courseId === '1')).toBe(false);
    expect(store.memberships.filter((m) => m.courseId === '1')).toEqual([]);
  });

  it('feeds matching, so a saved profile shows up in the next run', async () => {
    expect((await getCourseProfiles('1')).some((p) => p.studentId === '108')).toBe(false);
    await saveProfile(108n, '1', goodProfile);
    expect((await getCourseProfiles('1')).some((p) => p.studentId === '108')).toBe(true);
  });

  it('does not let matching change the store by editing what it got', async () => {
    const [first] = await getCourseProfiles('1');
    first.blocks.length = 0;
    expect((await getCourseProfiles('1'))[0].blocks.length).toBeGreaterThan(0);
  });

  it('gives averages for reviewed students only', async () => {
    const averages = await getAverages(['101', '102']);
    expect(averages.has('101')).toBe(false);
    expect(averages.get('102')).toBeCloseTo(3.2, 10);
  });
});

describe('profiles', () => {
  it('has nothing saved for a student who has not made one, and says Not yet rated', async () => {
    expect(await getOwnProfile(108n, '1')).toMatchObject({
      courseId: '1',
      name: 'Hailey Quinn',
      schoolEmail: 'hxq108@case.edu',
      gradeGoal: null,
      workStyle: null,
      blocks: [],
      reviewAverage: 'Not yet rated',
    });
  });

  it('gives the saved profile with sorted blocks and the average as text', async () => {
    const profile = await getOwnProfile(102n, '1');
    expect(profile.gradeGoal).toBe('A_TRACK');
    expect(profile.blocks.map((b) => b.weekday)).toEqual([1, 3]);
    expect(profile.reviewAverage).toBe('3.2');
  });

  it('saves a profile and gives it back', async () => {
    expect(await saveProfile(108n, '1', goodProfile)).toMatchObject(goodProfile);
    expect((await getOwnProfile(108n, '1')).gradeGoal).toBe('A_TRACK');
  });

  it('replaces the whole availability on an edit', async () => {
    await saveProfile(101n, '1', { ...goodProfile, blocks: [{ weekday: 5, startMinute: 600, endMinute: 660 }] });
    expect((await getOwnProfile(101n, '1')).blocks).toEqual([{ weekday: 5, startMinute: 600, endMinute: 660 }]);
    expect(store.profiles.filter((p) => p.studentId === '101' && p.courseId === '1')).toHaveLength(1);
  });

  it('merges overlapping blocks and splits one that crosses midnight', async () => {
    const saved = await saveProfile(108n, '1', {
      ...goodProfile,
      blocks: [
        { weekday: 1, startMinute: 540, endMinute: 600 },
        { weekday: 1, startMinute: 570, endMinute: 660 },
        { weekday: 6, startMinute: 1380, endMinute: 60 },
      ],
    });
    expect(saved.blocks).toEqual([
      { weekday: 0, startMinute: 0, endMinute: 60 },
      { weekday: 1, startMinute: 540, endMinute: 660 },
      { weekday: 6, startMinute: 1380, endMinute: 1440 },
    ]);
  });

  it('names every missing field and saves nothing', async () => {
    await expect(saveProfile(108n, '1', {})).rejects.toMatchObject({ fields: expect.arrayContaining(['gradeGoal', 'workStyle', 'blocks']) });
    await expect(saveProfile(108n, '1', { ...goodProfile, blocks: [] })).rejects.toMatchObject({ fields: ['blocks'] });
    expect((await getOwnProfile(108n, '1')).gradeGoal).toBeNull();
  });

  it('refuses a course the student is not on the roster of', async () => {
    await expect(saveProfile(108n, '2', goodProfile)).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
    await expect(saveProfile(999n, '1', goodProfile)).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
  });

  it('refuses a student that does not exist, and a course id that is not a number', async () => {
    await expect(getOwnProfile(424242n, '1')).rejects.toMatchObject({ code: 'STUDENT_NOT_FOUND' });
    await expect(getOwnProfile(101n, 'abc')).rejects.toThrow(ValidationError);
  });
});

describe('sending a request', () => {
  it('saves a pending request', async () => {
    const record = await send('101', '102');
    expect(record).toMatchObject({ courseId: '1', requesterId: '101', recipientId: '102', status: 'PENDING', respondedAt: null });
    expect(new Date(record.requestedAt).toString()).not.toBe('Invalid Date');
  });

  it('gives each request its own id', async () => {
    const first = await send('101', '102');
    const second = await send('101', '103');
    expect(second.requestId).not.toBe(first.requestId);
  });

  it('refuses yourself and an id that is not a number with VALIDATION', async () => {
    await expect(send('101', '101')).rejects.toMatchObject({ fields: ['recipientId'] });
    await expect(send('101', 'abc')).rejects.toThrow(ValidationError);
    expect(store.requests).toEqual([]);
  });

  it('refuses someone who is not on the roster, either way round', async () => {
    await expect(send('101', '999')).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
    await expect(send('999', '101')).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
  });

  it('refuses a sender with no profile or no free time', async () => {
    await expect(send('108', '101')).rejects.toMatchObject({ code: 'NO_PROFILE' });
    await expect(send('107', '101')).rejects.toMatchObject({ code: 'NO_PROFILE' });
  });

  it('refuses a recipient with no profile, another grade goal, or no shared time', async () => {
    await expect(send('101', '108')).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
    await expect(send('101', '104')).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
    await expect(send('101', '105')).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
  });

  it('refuses a second pending request to the same student, but not after it is answered', async () => {
    const first = await send('101', '102');
    await expect(send('101', '102')).rejects.toMatchObject({ code: 'DUPLICATE_REQUEST' });
    await cancel(101n, first.requestId);
    expect((await send('101', '102')).status).toBe('PENDING');
  });

  it('uses the profiles as they are now', async () => {
    await saveProfile(102n, '1', { ...goodProfile, gradeGoal: 'PASS_TRACK' });
    await expect(send('101', '102')).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });
  });
});

describe('listing requests', () => {
  it('shows sent and received newest first, with a limited summary of the other student', async () => {
    const older = await send('101', '102');
    const newer = await send('103', '101');

    const mine = await listRequests(101n, '1');
    expect(mine.map((r) => r.requestId)).toEqual([newer.requestId, older.requestId]);
    expect(mine[1].other).toMatchObject({ candidateId: '102', gradeGoal: 'A_TRACK', workStyle: 'GROUP' });
    expect(JSON.stringify(mine)).not.toMatch(/Brianna|@case\.edu/);
  });

  it('keeps a canceled request with the sender and drops it for the recipient', async () => {
    const sent = await send('101', '102');
    await cancel(101n, sent.requestId);
    expect((await listRequests(101n, '1'))[0].status).toBe('CANCELED');
    expect(await listRequests(102n, '1')).toEqual([]);
  });

  it('only shows your own, and only for the course asked', async () => {
    await send('101', '102');
    expect(await listRequests(103n, '1')).toEqual([]);
    expect(await listRequests(101n, '2')).toEqual([]);
  });

  it('gives other: null when they stopped matching, and still lists with no profile of your own', async () => {
    await send('101', '102');
    await saveProfile(102n, '1', { ...goodProfile, gradeGoal: 'PASS_TRACK' });
    expect((await listRequests(101n, '1'))[0].other).toBeNull();

    store.profiles = store.profiles.filter((p) => !(p.studentId === '102' && p.courseId === '1'));
    expect((await listRequests(102n, '1'))[0]).toMatchObject({ status: 'PENDING', other: null });
  });
});

describe('answering requests', () => {
  it('makes a group of the two when neither is in one', async () => {
    const answered = await match('101', '102');
    expect(answered.status).toBe('ACCEPTED');
    expect(answered.respondedAt).not.toBeNull();
    const group = (await getGroup(101n, '1'))!;
    expect(group.members.map((m) => m.studentId)).toEqual(['101', '102']);
    expect((await getGroup(102n, '1'))!.groupId).toBe(group.groupId);
  });

  it('gives each new group an id that is not one of last semester', async () => {
    await match('101', '102');
    const id = Number((await getGroup(101n, '1'))!.groupId);
    expect(id).toBeGreaterThan(5);
  });

  it('adds a student to the group of the one who asked, or of the one who was asked', async () => {
    await allMatch(['105', '107', '108']);
    await match('101', '105');
    await match('101', '107');
    await match('108', '105');
    const group = (await getGroup(101n, '1'))!;
    expect(group.members.map((m) => m.studentId)).toEqual(['101', '105', '107', '108']);
    expect(store.groups.filter((g) => g.courseId === '1')).toHaveLength(1);
  });

  it('will not merge two groups, and leaves the request pending', async () => {
    await allMatch(['105', '107', '108']);
    await match('101', '105');
    await match('107', '108');
    const sent = await send('101', '107');
    await expect(respond(107n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'GROUP_MERGE' });
    expect(store.requests.find((r) => String(r.id) === sent.requestId)?.status).toBe('PENDING');
    expect(store.groups.filter((g) => g.courseId === '1')).toHaveLength(2);
  });

  it('will not accept between two people already in the same group', async () => {
    await allMatch(['105', '107']);
    await match('101', '105');
    await match('101', '107');
    const sent = await send('105', '107');
    await expect(respond(107n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'GROUP_MERGE' });
  });

  it('needs both students to still have a complete profile and be on the roster', async () => {
    const sent = await send('101', '102');
    store.profiles = store.profiles.filter((p) => !(p.studentId === '101' && p.courseId === '1'));
    await expect(respond(102n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NO_LONGER_ELIGIBLE' });

    store.enrollments = store.enrollments.filter((e) => !(e.studentId === '101' && e.courseId === '1'));
    await expect(respond(102n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_ENROLLED' });
    expect(store.groups.filter((g) => g.courseId === '1')).toHaveLength(0);
  });

  it('declines with a time and no group, and then it can not be accepted', async () => {
    const sent = await send('101', '102');
    const answered = await respond(102n, sent.requestId, 'DECLINE');
    expect(answered.status).toBe('DECLINED');
    expect(answered.respondedAt).not.toBeNull();
    expect(store.groups.filter((g) => g.courseId === '1')).toHaveLength(0);
    await expect(respond(102n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_PENDING' });
    await expect(respond(102n, sent.requestId, 'DECLINE')).rejects.toMatchObject({ code: 'NOT_PENDING' });
  });

  it('only the recipient can answer, and a request that does not exist looks the same', async () => {
    const sent = await send('101', '102');
    await expect(respond(101n, sent.requestId, 'ACCEPT')).rejects.toThrow(ForbiddenError);
    await expect(respond(103n, sent.requestId, 'DECLINE')).rejects.toThrow(ForbiddenError);
    await expect(respond(101n, '999999', 'ACCEPT')).rejects.toThrow(ForbiddenError);
    await expect(respond(101n, 'abc', 'ACCEPT')).rejects.toThrow(ValidationError);
  });

  it('can not be answered twice', async () => {
    const sent = await send('101', '102');
    await respond(102n, sent.requestId, 'ACCEPT');
    await expect(respond(102n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_PENDING' });
    expect(store.groups.filter((g) => g.courseId === '1')).toHaveLength(1);
  });
});

describe('canceling', () => {
  it('lets the sender withdraw a pending request, and then nobody can accept it', async () => {
    const sent = await send('101', '102');
    const canceled = await cancel(101n, sent.requestId);
    expect(canceled.status).toBe('CANCELED');
    expect(canceled.respondedAt).not.toBeNull();
    await expect(respond(102n, sent.requestId, 'ACCEPT')).rejects.toMatchObject({ code: 'NOT_PENDING' });
  });

  it('only the sender, and only while pending', async () => {
    const sent = await send('101', '102');
    await expect(cancel(102n, sent.requestId)).rejects.toThrow(ForbiddenError);
    await expect(cancel(101n, '999999')).rejects.toThrow(ForbiddenError);
    await respond(102n, sent.requestId, 'ACCEPT');
    await expect(cancel(101n, sent.requestId)).rejects.toMatchObject({ code: 'NOT_PENDING' });
  });
});

describe('groups and matched profiles', () => {
  it('has no group until a request is accepted', async () => {
    expect(await getGroup(101n, '1')).toBeNull();
    await send('101', '102');
    expect(await getGroup(101n, '1')).toBeNull();
  });

  it('lists the members by name with the criteria', async () => {
    await match('101', '102');
    const group = (await getGroup(101n, '1'))!;
    expect(group.criteria).toEqual(REVIEW_CRITERIA);
    expect(group.members).toEqual([
      { studentId: '101', name: 'Alex Rivera', reviewedByMe: false },
      { studentId: '102', name: 'Brianna Cole', reviewedByMe: false },
    ]);
    expect(await getGroup(101n, '2')).toBeNull();
  });

  it('shows the full profile with the email after an accepted request, from either side', async () => {
    await match('101', '102');
    expect(await getMatchedProfile(101n, '1', '102')).toMatchObject({
      studentId: '102',
      name: 'Brianna Cole',
      schoolEmail: 'bxc102@case.edu',
      gradeGoal: 'A_TRACK',
      reviewAverage: 3.2,
    });
    expect((await getMatchedProfile(102n, '1', '101')).studentId).toBe('101');
  });

  it('refuses while pending, after a decline or cancel, for a groupmate, a stranger and another course', async () => {
    await allMatch(['105', '107']);
    await send('101', '102');
    await expect(getMatchedProfile(101n, '1', '102')).rejects.toThrow(ForbiddenError);

    const declined = await send('101', '103');
    await respond(103n, declined.requestId, 'DECLINE');
    await expect(getMatchedProfile(101n, '1', '103')).rejects.toThrow(ForbiddenError);

    await match('101', '105');
    await match('101', '107');
    // 105 and 107 share a group but have no accepted request between them
    await expect(getMatchedProfile(105n, '1', '107')).rejects.toThrow(ForbiddenError);
    await expect(getMatchedProfile(101n, '1', '999')).rejects.toThrow(ForbiddenError);
    await expect(getMatchedProfile(101n, '2', '105')).rejects.toThrow(ForbiddenError);
  });
});

describe('peer reviews', () => {
  async function groupOf101And102() {
    await match('101', '102');
    return (await getGroup(101n, '1'))!.groupId;
  }

  it('saves the ratings and gives back the average of everything they received', async () => {
    const groupId = await groupOf101And102();
    const result = await submitReview(101n, groupId, {
      revieweeId: '102',
      ratings: [
        { criteriaName: 'Communication', rating: 5 },
        { criteriaName: 'Reliability', rating: 5 },
        { criteriaName: 'Contribution', rating: 5 },
      ],
    });
    // 102 had 15 ratings adding up to 48, and now gets three 5s
    expect(result.revieweeAverage).toBeCloseTo(63 / 18, 10);
    expect(store.reviews.at(-1)).toMatchObject({ reviewerId: '101', revieweeId: '102', groupId });
  });

  it('takes the criteria in any order', async () => {
    const groupId = await groupOf101And102();
    await expect(submitReview(101n, groupId, { revieweeId: '102', ratings: [...rate(4)].reverse() })).resolves.toBeDefined();
  });

  it('needs every criterion once, whole numbers from 1 to 5', async () => {
    const groupId = await groupOf101And102();
    const review = (ratings: unknown) => submitReview(101n, groupId, { revieweeId: '102', ratings });
    await expect(review(rate(4).slice(1))).rejects.toThrow(ValidationError);
    await expect(review([...rate(4), { criteriaName: 'Punctuality', rating: 4 }])).rejects.toThrow(ValidationError);
    await expect(review([...rate(4).slice(1), ...rate(4).slice(1)])).rejects.toThrow(ValidationError);
    for (const bad of [0, 6, 3.5]) {
      await expect(review(rate(4).map((r, i) => (i === 0 ? { ...r, rating: bad } : r)))).rejects.toThrow(ValidationError);
    }
    await expect(submitReview(101n, groupId, {})).rejects.toMatchObject({ fields: ['revieweeId', 'ratings'] });
    expect(store.reviews.some((r) => r.reviewerId === '101' && r.revieweeId === '102')).toBe(false);
  });

  it('is only for people in the group, never yourself', async () => {
    const groupId = await groupOf101And102();
    const review = (who: bigint, reviewee: string, group = groupId) => submitReview(who, group, { revieweeId: reviewee, ratings: rate(4) });
    await expect(review(101n, '101')).rejects.toThrow(ForbiddenError);
    await expect(review(101n, '103')).rejects.toThrow(ForbiddenError);
    await expect(review(103n, '101')).rejects.toThrow(ForbiddenError);
    await expect(review(101n, '102', '999999')).rejects.toThrow(ForbiddenError);
  });

  it('is only once per person per group', async () => {
    const groupId = await groupOf101And102();
    await submitReview(101n, groupId, { revieweeId: '102', ratings: rate(5) });
    await expect(submitReview(101n, groupId, { revieweeId: '102', ratings: rate(1) })).rejects.toMatchObject({ code: 'DUPLICATE_REVIEW' });
    // the other way round is a different review
    await expect(submitReview(102n, groupId, { revieweeId: '101', ratings: rate(4) })).resolves.toBeDefined();
  });

  it('shows up as reviewedByMe, and in the matched profile', async () => {
    const groupId = await groupOf101And102();
    await submitReview(101n, groupId, { revieweeId: '102', ratings: rate(4) });
    expect((await getGroup(101n, '1'))!.members.find((m) => m.studentId === '102')!.reviewedByMe).toBe(true);
    expect((await getGroup(102n, '1'))!.members.every((m) => !m.reviewedByMe)).toBe(true);
    expect((await getMatchedProfile(101n, '1', '102')).reviewAverage).toBeCloseTo((48 + 12) / 18, 1);
  });
});
