// shared data types from sdd section 6.2.
// ids are strings so bigint values from postgres don't get rounded by js numbers.

export type Id = string;

export type GradeGoal = 'A_TRACK' | 'PASS_TRACK';

export type WorkStyle = 'SOLO' | 'GROUP';

// one recurring weekly interval. weekday is 0-6 (0 = sunday),
// minutes are from midnight in America/New_York, 0 <= start < end <= 1440.
export interface AvailabilityBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

// a saved course profile (sdd 5.1). matching only ever reads these.
export interface Profile {
  profileId: Id;
  studentId: Id;
  courseId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  blocks: AvailabilityBlock[];
}

// the limited summary shown before a match (PR-1, Request.LimitedView).
// no name, email or full availability grid on purpose.
export interface CandidateSummary {
  candidateId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  sharedIntervals: AvailabilityBlock[];
  reviewAverage: number | null;
}
