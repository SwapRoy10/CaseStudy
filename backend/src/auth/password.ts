import { randomInt } from 'node:crypto';
import argon2 from 'argon2';

// passwords are hashed with argon2id (sdd 9.3). the library picks a random salt
// every time and keeps it inside the hash string, so there is nothing else to store.
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// a bad or placeholder hash just counts as a wrong password
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// a first password for an account the operator creates. no 0/O or 1/l/I so it
// can be read off a printout without mistakes.
const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePassword(length = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) password += LETTERS[randomInt(LETTERS.length)];
  return password;
}
