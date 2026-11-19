import { afterAll, describe, expect, it } from 'vitest';
import { config } from '../config';
import { prisma } from '../db';
import { DEMO_PASSWORD } from '../sampleData';
import * as mock from './mockAccounts';
import * as postgres from './postgresAccounts';
import { hashPassword, verifyPassword } from './password';

// both account sources have to give the same answers. the in memory one always
// runs, the postgres one only when there is a seeded database (npm run db:up)

const sources = [
  { name: 'in memory sample data', source: mock, skip: false },
  { name: 'postgres', source: postgres, skip: config.useMockData },
];

afterAll(async () => {
  await prisma.$disconnect();
});

it('looks up a demo student by id and uses their updated password hash', async () => {
  const account = await mock.findAccountById('108');
  expect(account?.id).toBe('108');
  expect(await mock.findAccountById('999999')).toBeNull();
  const passwordHash = await hashPassword('replacement demo password');
  await mock.setPasswordHash(account!.id, passwordHash);
  try {
    expect((await mock.findAccountById(account!.id))?.passwordHash).toBe(passwordHash);
  } finally {
    await mock.setPasswordHash(account!.id, account!.passwordHash);
  }
});

describe.each(sources)('accounts from $name', ({ source, skip }) => {
  describe.skipIf(skip)('findAccountByEmail', () => {
    it('finds a student by email, ignoring case', async () => {
      const account = await source.findAccountByEmail('AXR101@case.edu');
      expect(account).toMatchObject({ id: '101', name: 'Alex Rivera', tutorialCompleted: false });
    });

    it('gives a hash that matches the demo password', async () => {
      const account = await source.findAccountByEmail('axr101@case.edu');
      expect(await verifyPassword(account!.passwordHash, DEMO_PASSWORD)).toBe(true);
    });

    it('gives null for an email with no account', async () => {
      expect(await source.findAccountByEmail('nobody@case.edu')).toBeNull();
    });
  });

  describe.skipIf(skip)('getMe', () => {
    it('lists the courses the student is on the roster of', async () => {
      // 105 is on both sample courses
      const me = await source.getMe('105');
      expect(me?.name).toBe('Elijah Ford');
      expect(me?.courses.map((c) => [c.id, c.code])).toEqual([
        ['1', 'SAMPLE 101'],
        ['2', 'SAMPLE 102'],
      ]);
    });

    it('says whether the student has a profile in each course', async () => {
      // 108 is on course 1 but never saved a profile, 101 did
      expect((await source.getMe('108'))?.courses.find((c) => c.id === '1')?.hasProfile).toBe(false);
      expect((await source.getMe('101'))?.courses.find((c) => c.id === '1')?.hasProfile).toBe(true);
    });

    it('gives null for a student that does not exist', async () => {
      expect(await source.getMe('999999')).toBeNull();
    });

    it('leaves out past semesters', async () => {
      // 1001 is on csds 393 (Fall 2026) and was in csds 132 and 233 last spring
      const me = await source.getMe('1001');
      expect(me?.courses.map((c) => c.code)).toEqual(['CSDS 393']);
    });
  });
});
