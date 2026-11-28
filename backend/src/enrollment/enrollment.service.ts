// collaborative code by the group and claude sonnet 5.5
// some parts are original code by marana, written by hand

import { generatePassword, hashPassword } from '../auth/password';
import { config } from '../config';
import { prisma } from '../db';
import { ValidationError, StateConflictError, toId } from '../errors';
import { parseRosterFile } from './rosterFile';

export interface BadRow {
  row: number;
  reason: string;
}

// account made during an import, with its first password
export interface CreatedAccount {
  email: string;
  name: string;
  password: string;
}

// adds a roster file's students to a course, all or nothing
export async function importRosterWithReasons(
  courseIdRaw: string | bigint,
  text: string,
  options: { createAccounts?: boolean } = {}
) {
  const courseId = toId(courseIdRaw, 'courseId');
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new StateConflictError('COURSE_NOT_FOUND');

  const rows = parseRosterFile(text, config.schoolEmailDomain);
  if (rows.length === 0) throw new ValidationError(['file']);

  // case insensitive so capitals still find the account
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))];
  const students = await prisma.student.findMany({
    where: { OR: emails.map((e) => ({ schoolEmail: { equals: e, mode: 'insensitive' as const } })) },
    select: { id: true, schoolEmail: true },
  });
  const idByEmail = new Map(students.map((s) => [s.schoolEmail.toLowerCase(), s.id]));

  const badRows: BadRow[] = []; // problems found, checked before any write
  const toCreate = new Map<string, string>(); // email to name
  for (const r of rows) {
    if (r.problem) badRows.push({ row: r.row, reason: r.problem });
    else if (!idByEmail.has(r.email) && options.createAccounts) toCreate.set(r.email, r.name ?? r.email.split('@')[0]);
    else if (!idByEmail.has(r.email)) badRows.push({ row: r.row, reason: 'no account for that email' });
    else if (r.course && (r.course.code !== course.code || r.course.section !== course.section || r.course.term !== course.term)) {
      badRows.push({ row: r.row, reason: 'row is for a different course' });
    }
  }
  if (badRows.length) return { ok: false as const, rows: badRows };

  // hash before the transaction, it's slow on purpose
  const accounts: CreatedAccount[] = [...toCreate].map(([email, name]) => ({ email, name, password: generatePassword() }));
  const hashes = await Promise.all(accounts.map((a) => hashPassword(a.password)));

  const result = await prisma.$transaction(async (tx) => {
    if (accounts.length) {
      await tx.student.createMany({
        data: accounts.map((a, i) => ({ name: a.name, schoolEmail: a.email, passwordHash: hashes[i] })),
      });
      const made = await tx.student.findMany({
        where: { schoolEmail: { in: accounts.map((a) => a.email) } },
        select: { id: true, schoolEmail: true },
      });
      made.forEach((s) => idByEmail.set(s.schoolEmail.toLowerCase(), s.id));
    }

    // listed twice is still one enrollment
    const studentIds = [...new Set(rows.map((r) => idByEmail.get(r.email)!))];
    const enrolled = await tx.enrollment.createMany({
      data: studentIds.map((studentId) => ({ studentId, courseId })),
      skipDuplicates: true,
    });
    return { added: enrolled.count, total: studentIds.length };
  });
  return { ok: true as const, ...result, accounts };
}

// same import, old answer shape (bad row numbers only)
export async function importRoster(courseIdRaw: string | bigint, text: string) {
  const result = await importRosterWithReasons(courseIdRaw, text);
  return result.ok ? result : { ok: false as const, badRows: result.rows.map((r) => r.row) };
}
