// shared types from sdd 6.2, string ids so bigints don't get rounded

export type Id = string;

export type GradeGoal = 'A_TRACK' | 'PASS_TRACK';

export type WorkStyle = 'SOLO' | 'GROUP';

// weekday 0 to 6 (0 sunday), minutes from midnight, America/New_York
export interface AvailabilityBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

// saved course profile (sdd 5.1), matching only reads these
export interface Profile {
  profileId: Id;
  studentId: Id;
  courseId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  blocks: AvailabilityBlock[];
}

// limited summary before a match (PR-1, Request.LimitedView), no name or email
export interface CandidateSummary {
  candidateId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  sharedIntervals: AvailabilityBlock[];
  reviewAverage: number | null;
}
