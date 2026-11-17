import { config } from '../config';
import { prisma } from '../db';
import { ValidationError, StateConflictError, toId } from '../errors';
import { parseRosterFile } from './rosterFile';

export interface BadRow {
  row: number;
  reason: string;
}

// puts the students in a roster file on one course's roster. the whole file is
// checked before anything is written, so one bad row means nothing changes.
// the file can be the sdd format or a canvas gradebook export (see rosterFile.ts).
// a failed import says why each row failed, which is what the api sends back.
export async function importRosterWithReasons(courseIdRaw: string | bigint, text: string) {
  const courseId = toId(courseIdRaw, 'courseId');
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new StateConflictError('COURSE_NOT_FOUND');

  const rows = parseRosterFile(text, config.schoolEmailDomain);
  if (rows.length === 0) throw new ValidationError(['file']);

  // emails are compared without case, so one typed in capitals still finds its account
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))];
  const students = await prisma.student.findMany({
    where: { OR: emails.map((e) => ({ schoolEmail: { equals: e, mode: 'insensitive' as const } })) },
    select: { id: true, schoolEmail: true },
  });
  const idByEmail = new Map(students.map((s) => [s.schoolEmail.toLowerCase(), s.id]));

  const badRows: BadRow[] = [];
  for (const r of rows) {
    if (r.problem) badRows.push({ row: r.row, reason: r.problem });
    else if (!idByEmail.has(r.email)) badRows.push({ row: r.row, reason: 'no account for that email' });
    else if (r.course && (r.course.code !== course.code || r.course.section !== course.section || r.course.term !== course.term)) {
      badRows.push({ row: r.row, reason: 'row is for a different course' });
    }
  }
  if (badRows.length) return { ok: false as const, rows: badRows };

  // a student listed twice is still one enrollment
  const studentIds = [...new Set(rows.map((r) => idByEmail.get(r.email)!))];
  const result = await prisma.$transaction((tx) =>
    tx.enrollment.createMany({
      data: studentIds.map((studentId) => ({ studentId, courseId })),
      skipDuplicates: true,
    }),
  );
  return { ok: true as const, added: result.count, total: studentIds.length };
}

// the same import with the original answer shape: a failed import is just the row
// numbers that were bad. kept as it was so existing callers and tests don't change.
export async function importRoster(courseIdRaw: string | bigint, text: string) {
  const result = await importRosterWithReasons(courseIdRaw, text);
  return result.ok ? result : { ok: false as const, badRows: result.rows.map((r) => r.row) };
}
