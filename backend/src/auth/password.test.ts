import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('passwords', () => {
  it('checks a password against its hash', async () => {
    const hash = await hashPassword('correct horse');
    expect(await verifyPassword(hash, 'correct horse')).toBe(true);
    expect(await verifyPassword(hash, 'wrong horse')).toBe(false);
  });

  it('uses argon2id and never stores the password', async () => {
    const hash = await hashPassword('correct horse');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse');
  });

  it('gives a different hash each time for the same password', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('treats a placeholder hash as a wrong password instead of crashing', async () => {
    expect(await verifyPassword('seed-placeholder-not-a-real-hash', 'anything')).toBe(false);
  });
});
