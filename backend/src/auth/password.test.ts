// collaborative code by somesh and claude sonnet 5.5

import { describe, expect, it } from 'vitest';
import { generatePassword, hashPassword, verifyPassword } from './password';

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

describe('generatePassword', () => {
  it('makes a password of the length asked for, 10 by default', () => {
    expect(generatePassword()).toHaveLength(10);
    expect(generatePassword(16)).toHaveLength(16);
  });

  it('leaves out the letters that look alike', () => {
    for (let i = 0; i < 50; i++) expect(generatePassword(40)).not.toMatch(/[0OlI1]/);
  });

  it('is different every time', () => {
    const made = new Set(Array.from({ length: 50 }, () => generatePassword()));
    expect(made.size).toBe(50);
  });
});
