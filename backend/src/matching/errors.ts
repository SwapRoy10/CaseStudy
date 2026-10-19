// SDD 10.3: modules throw typed errors and the API layer maps them to an
// ApiError + HTTP status. A failed db read just throws, and the API layer
// turns that into UNAVAILABLE.
// Full reason list from sdd 10.3 so other modules can reuse this, matching only uses NO_PROFILE.

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
