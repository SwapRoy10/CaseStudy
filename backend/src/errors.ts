// original code by marana, written by hand

export class ValidationError extends Error {
  readonly code = 'VALIDATION';
  constructor(public readonly fields: string[]) {
    super(`Invalid or missing: ${fields.join(', ')}`);
  }
}

export class StateConflictError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

// caller isn't allowed to do this, becomes a 403 (sdd 6.4)
export class ForbiddenError extends Error {
  constructor(message = 'You are not allowed to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function toId(id: string | bigint, field = 'id'): bigint {
  if (typeof id === 'bigint') return id;
  if (!/^\d+$/.test(id)) throw new ValidationError([field]);
  return BigInt(id);
}