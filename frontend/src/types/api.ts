// mirrors backend/src/matching/types.ts. keep the two in sync when the api changes.

export type Id = string;
export type GradeGoal = 'A_TRACK' | 'PASS_TRACK';
export type WorkStyle = 'SOLO' | 'GROUP';

// weekday 0-6 (0 = sunday), minutes from midnight, America/New_York
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

// every backend error has this body (backend/src/middleware/errorHandler.ts)
export interface ApiErrorBody {
  error: { code: string; message: string; reason?: string };
}

// demo only, from GET /api/demo/roster (backend/src/controllers/demo.controller.ts).
// goes away once real sign in exists
export interface DemoStudent {
  id: Id;
  name: string;
  hasProfile: boolean;
}

export interface DemoCourse {
  id: Id;
  code: string;
  title: string;
  term: string;
  students: DemoStudent[];
}
