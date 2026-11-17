import { ValidationError } from '../errors';
import { parseCsv } from './csv';

// one student line from a roster file. row is the line number in the file (the
// header is row 1), so a problem can be pointed at in excel.
export interface RosterRow {
  row: number;
  email: string;
  // only the sdd format names a course in every row
  course?: { code: string; section: string; term: string };
  // set when the line can't be used, like a student with no login id
  problem?: string;
}

// two kinds of file are accepted:
//   the sdd format: course_code, section, term, school_email
//   a canvas gradebook export: Student, ID, SIS User ID, SIS Login ID, Section, then
//   one column per assignment. canvas has no roster export of its own, the
//   gradebook export is the usual way to get the student list out of a course.
// the school email is not in a canvas export, so it's built from the login id
// (the case id) and the school domain.
export function parseRosterFile(text: string, emailDomain: string): RosterRow[] {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((c) => c.trim().toLowerCase());
  const body = table.slice(1);
  const col = (name: string) => header.indexOf(name);

  if (col('school_email') >= 0 && col('course_code') >= 0 && col('section') >= 0 && col('term') >= 0) {
    return parseSddRows(body, header);
  }

  // canvas calls it SIS Login ID. some exports have a plain email column instead
  const idColumn = ['sis login id', 'login id', 'email', 'email address'].map(col).find((i) => i >= 0);
  if (idColumn === undefined) throw new ValidationError(['header']);

  const nameColumn = Math.max(col('student'), 0);
  return parseCanvasRows(body, idColumn, nameColumn, emailDomain);
}

function parseSddRows(body: string[][], header: string[]): RosterRow[] {
  const at = (r: string[], name: string) => (r[header.indexOf(name)] ?? '').trim();
  const rows: RosterRow[] = [];

  body.forEach((r, i) => {
    if (r.every((c) => c.trim() === '')) return;
    rows.push({
      row: i + 2,
      email: at(r, 'school_email').toLowerCase(),
      course: { code: at(r, 'course_code'), section: at(r, 'section'), term: at(r, 'term') },
    });
  });
  return rows;
}

// the lines canvas adds that aren't students: a points row under the header, a
// manual posting row in the new gradebook, and the fake "Test Student"
function isCanvasExtra(name: string) {
  const n = name.trim().toLowerCase();
  return n === 'points possible' || n === 'manual posting' || n === 'student, test' || n === 'test student';
}

function parseCanvasRows(body: string[][], idColumn: number, nameColumn: number, emailDomain: string): RosterRow[] {
  const rows: RosterRow[] = [];

  body.forEach((r, i) => {
    if (r.every((c) => c.trim() === '')) return;
    if (isCanvasExtra(r[nameColumn] ?? '')) return;

    const id = (r[idColumn] ?? '').trim().toLowerCase();
    if (!id) {
      rows.push({ row: i + 2, email: '', problem: 'no login id' });
      return;
    }
    // a login id that is already an email is used as is
    rows.push({ row: i + 2, email: id.includes('@') ? id : `${id}@${emailDomain}` });
  });
  return rows;
}
