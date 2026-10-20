// Mirrors backend/src/matching/types.ts. Keep the two in sync when the API changes.

export type Id = string;
export type GradeGoal = 'A_TRACK' | 'PASS_TRACK';
export type WorkStyle = 'SOLO' | 'GROUP';

// weekday 0-6 (0 = Sunday), minutes from midnight, America/New_York
export interface AvailabilityBlock {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export interface CandidateSummary {
  candidateId: Id;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  sharedIntervals: AvailabilityBlock[];
  reviewAverage: number | null;
}

export interface CandidatesResponse {
  courseId: Id;
  candidates: CandidateSummary[];
}

// Every backend error has this body (backend/src/middleware/errorHandler.ts)
export interface ApiErrorBody {
  error: { code: string; message: string; reason?: string };
}
