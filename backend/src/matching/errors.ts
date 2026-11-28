// original code by somesh, written by hand

// sdd 10.3, typed errors the api layer maps to a status

export type ConflictReason =
  | 'NOT_ENROLLED'
  | 'NO_PROFILE'
  | 'NO_LONGER_ELIGIBLE'
  | 'DUPLICATE_REQUEST'
  | 'NOT_PENDING'
  | 'GROUP_MERGE'
  | 'DUPLICATE_REVIEW';

export class StateConflictError extends Error {
  reason: ConflictReason;

  constructor(reason: ConflictReason, message: string) {
    super(message);
    this.name = 'StateConflictError';
    this.reason = reason;
  }
}
