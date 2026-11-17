import type { CandidateSummary } from '../matching/types';

// sdd 6.2
export type RequestStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELED';

export interface RequestRecord {
  requestId: string;
  courseId: string;
  requesterId: string;
  recipientId: string;
  status: RequestStatus;
  requestedAt: string;
  respondedAt: string | null;
  // the other student's limited summary (PR-1), worked out from the caller's side.
  // null when they no longer pass the matching filters. no name or email.
  other?: CandidateSummary | null;
}

export interface GroupMember {
  studentId: string;
  name: string;
  reviewedByMe: boolean;
}

export interface GroupView {
  groupId: string;
  courseId: string;
  formedAt: string;
  members: GroupMember[];
  criteria: string[];
}
