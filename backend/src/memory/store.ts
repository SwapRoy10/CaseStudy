// collaborative code by somesh and claude sonnet 5.5

import { REVIEW_CRITERIA } from '../reviews/criteria';
import { enrollments, pastGroups, profiles as sampleProfiles, reviews as sampleReviews } from '../sampleData';
import type { Profile } from '../matching/types';

// in memory database for the demo, starts from sampleData.ts, resets on restart

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
  // next ids, start after the sample data
  nextRequestId: 1,
  nextGroupId: 1,
  nextReviewId: 1,
};

// back to sampleData.ts, tests call this before each one
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
    // same order as REVIEW_CRITERIA
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

// average of all ratings received, null if none (Review.Average)
export function averageFor(studentId: string): number | null {
  const ratings = store.reviews.filter((r) => r.revieweeId === studentId).flatMap((r) => r.ratings);
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
}
