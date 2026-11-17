import { REVIEW_CRITERIA } from '../reviews/criteria';
import { enrollments, pastGroups, profiles as sampleProfiles, reviews as sampleReviews } from '../sampleData';
import type { Profile } from '../matching/types';

// the in memory version of the database for the demo with no DATABASE_URL. it
// starts from sampleData.ts, the same rows the seed loads, and keeps whatever
// students do (profile saves, requests, groups, reviews) until the server stops.

export interface StoredRequest {
  id: number;
  courseId: string;
  requesterId: string;
  recipientId: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED';
  requestedAt: Date;
  respondedAt: Date | null;
}

export interface StoredGroup {
  id: string;
  courseId: string;
  formedAt: Date;
}

export interface StoredMembership {
  groupId: string;
  studentId: string;
  courseId: string;
}

export interface StoredReview {
  id: number;
  reviewerId: string;
  revieweeId: string;
  groupId: string;
  ratings: { criteriaName: string; rating: number }[];
}

export const store = {
  profiles: [] as Profile[],
  enrollments: [] as { studentId: string; courseId: string }[],
  requests: [] as StoredRequest[],
  groups: [] as StoredGroup[],
  memberships: [] as StoredMembership[],
  reviews: [] as StoredReview[],
  // ids for new rows, picked up from where the sample data stops
  nextRequestId: 1,
  nextGroupId: 1,
  nextReviewId: 1,
};

// puts everything back the way sampleData.ts has it. the tests call this before each one
export function resetStore() {
  store.profiles = sampleProfiles.map((p) => ({
    profileId: `${p.studentId}-${p.courseId}`,
    studentId: p.studentId,
    courseId: p.courseId,
    gradeGoal: p.gradeGoal,
    workStyle: p.workStyle,
    blocks: p.blocks.map((b) => ({ ...b })),
  }));
  store.enrollments = enrollments.map((e) => ({ ...e }));
  store.requests = [];

  const lastSemester = new Date('2026-04-30T12:00:00Z');
  store.groups = pastGroups.map((g) => ({ id: g.id, courseId: g.courseId, formedAt: lastSemester }));
  store.memberships = pastGroups.flatMap((g) => g.members.map((m) => ({ groupId: g.id, studentId: m, courseId: g.courseId })));

  store.reviews = sampleReviews.map((r, i) => ({
    id: i + 1,
    reviewerId: r.reviewerId,
    revieweeId: r.revieweeId,
    groupId: r.groupId,
    // sampleData has the three ratings in the same order as the criteria
    ratings: [r.communication, r.reliability, r.contribution].map((rating, n) => ({ criteriaName: REVIEW_CRITERIA[n], rating })),
  }));

  store.nextRequestId = 1;
  store.nextGroupId = Math.max(...pastGroups.map((g) => Number(g.id))) + 1;
  store.nextReviewId = store.reviews.length + 1;
}

resetStore();

export function isEnrolled(studentId: string, courseId: string) {
  return store.enrollments.some((e) => e.studentId === studentId && e.courseId === courseId);
}

// average over every rating a student has received, null if none (Review.Average)
export function averageFor(studentId: string): number | null {
  const ratings = store.reviews.filter((r) => r.revieweeId === studentId).flatMap((r) => r.ratings);
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
}
