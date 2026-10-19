// Shared data types from SDD Section 6.2.
// IDs are strings so bigint values from Postgres don't get rounded by JS numbers.

export type Id = string;

export type GradeGoal = 'A_TRACK' | 'PASS_TRACK';

export type WorkStyle = 'SOLO' | 'GROUP';

// One recurring weekly interval. weekday is 0-6 (0 = Sunday),
// minutes are from midnight in America/New_York, 0 <= start < end <= 1440.
export interface AvailabilityBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

// A saved course profile (SDD 5.1). Matching only ever reads these.
export interface Profile {
  profileId: Id;
  studentId: Id;
  courseId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  blocks: AvailabilityBlock[];
}

// The limited summary shown before a match (PR-1, Request.LimitedView).
// No name, email or full availability grid on purpose.
export interface CandidateSummary {
  candidateId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  sharedIntervals: AvailabilityBlock[];
  reviewAverage: number | null;
}
