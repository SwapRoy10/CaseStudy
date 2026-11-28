// collaborative code by somesh and claude sonnet 5.5
// some parts are original code by swap, written by hand

// mirrors backend/src/matching/types.ts, keep both in sync

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

// body of every backend error (backend/src/middleware/errorHandler.ts)
export interface ApiErrorBody {
  error: { code: string; message: string; reason?: string; fields?: string[] };
}

// from get /api/courses (backend/src/courses/listCourses.ts), enrolled or not
export interface CourseSummary {
  courseId: Id;
  code: string;
  title: string;
  section: string;
  term: string;
}

// from get /api/me (backend/src/auth/types.ts)
export interface MyCourse {
  id: Id;
  code: string;
  title: string;
  section: string;
  term: string;
  hasProfile: boolean;
}

export interface Me {
  studentId: Id;
  name: string;
  tutorialCompleted: boolean;
  courses: MyCourse[];
}

export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED';

// from backend/src/requests/types.ts, other is null if they no longer match
export interface RequestRecord {
  requestId: Id;
  courseId: Id;
  requesterId: Id;
  recipientId: Id;
  status: RequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  other?: CandidateSummary | null;
}

export interface GroupMember {
  studentId: Id;
  name: string;
  reviewedByMe: boolean;
}

export interface GroupView {
  groupId: Id;
  courseId: Id;
  formedAt: string;
  members: GroupMember[];
  criteria: string[];
}

// reviewAverage is null until rated, get /profile gives null if nothing saved
export interface OwnProfile {
  courseId: Id;
  name: string;
  schoolEmail: string;
  gradeGoal: GradeGoal;
  workStyle: WorkStyle;
  blocks: AvailabilityBlock[];
  reviewAverage: number | null;
}

// full profile of a match, only after an accepted request
export interface MatchedProfile extends OwnProfile {
  studentId: Id;
}

export interface ProfileInput {
  gradeGoal: GradeGoal | '';
  workStyle: WorkStyle | '';
  blocks: AvailabilityBlock[];
}

export interface ReviewRating {
  criteriaName: string;
  rating: number;
}

// demo only, from get /api/demo/roster (missing in production)
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
