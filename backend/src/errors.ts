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

export function toId(id: string | bigint, field = 'id'): bigint {
  if (typeof id === 'bigint') return id;
  if (!/^\d+$/.test(id)) throw new ValidationError([field]);
  return BigInt(id);
}