import { prisma } from '../db';
import { ValidationError, StateConflictError, toId } from '../errors';

const HEADER = ['course_code', 'section', 'term', 'school_email'];

export async function importRoster(courseIdRaw: string | bigint, csv: string) {
  const courseId = toId(courseIdRaw, 'courseId');
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new StateConflictError('COURSE_NOT_FOUND');

  const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const header = lines.shift()?.toLowerCase().split(',').map((s) => s.trim());
  if (!header || HEADER.some((h, i) => header[i] !== h)) throw new ValidationError(['header']);

  const rows = lines.map((line, i) => {
    const [code, section, term, email] = line.split(',').map((s) => s.trim());
    return { rowNumber: i + 2, code, section, term, email: email?.toLowerCase() };
  });

  // Check every row before writing anything.
  const emails = [...new Set(rows.map((r) => r.email).filter((e): e is string => !!e))];
  const students = await prisma.student.findMany({
    where: { schoolEmail: { in: emails } },
    select: { id: true, schoolEmail: true },
  });
  const idByEmail = new Map(students.map((s) => [s.schoolEmail.toLowerCase(), s.id]));

  const badRows = rows
    .filter((r) => !r.email || !idByEmail.has(r.email) ||
      r.code !== course.code || r.section !== course.section || r.term !== course.term)
    .map((r) => r.rowNumber);
  if (badRows.length) return { ok: false as const, badRows };

  const studentIds = [...new Set(rows.map((r) => idByEmail.get(r.email!)!))];
  const result = await prisma.$transaction((tx) =>
    tx.enrollment.createMany({
      data: studentIds.map((studentId) => ({ studentId, courseId })),
      skipDuplicates: true,
    }),
  );
  return { ok: true as const, added: result.count, total: studentIds.length };
}