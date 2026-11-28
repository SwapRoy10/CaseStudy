// collaborative code by the group and claude sonnet 5.5

import { randomInt } from 'node:crypto';
import argon2 from 'argon2';

// argon2id (sdd 9.3), the salt is stored inside the hash string
export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

// a bad or placeholder hash just counts as a wrong password
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password); // throws on a bad hash
  } catch {
    return false;
  }
}

// first password for new accounts, no 0/O or 1/l/I so it reads off a printout
const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generatePassword(length = 10): string {
  let password = '';
  for (let i = 0; i < length; i++) password += LETTERS[randomInt(LETTERS.length)]; // crypto random pick
  return password;
}
