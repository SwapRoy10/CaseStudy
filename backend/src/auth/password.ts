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
