import { ValidationError } from '../errors';
import { parseCsv } from './csv';

// one student line, row is the file line number (header is row 1)
export interface RosterRow {
  row: number;
  email: string;
  // from the canvas Student column, used when making an account
  name?: string;
  // only the sdd format has a course on every row
  course?: { code: string; section: string; term: string };
  // set when the line can't be used, like no login id
  problem?: string;
}

// sdd format or a canvas gradebook export (email built from login id)
export function parseRosterFile(text: string, emailDomain: string): RosterRow[] {
  const table = parseCsv(text);
  const header = (table[0] ?? []).map((c) => c.trim().toLowerCase());
  const body = table.slice(1);
  const col = (name: string) => header.indexOf(name); // -1 if missing

  if (col('school_email') >= 0 && col('course_code') >= 0 && col('section') >= 0 && col('term') >= 0) {
    return parseSddRows(body, header);
  }

  // canvas calls it SIS Login ID, some exports have a plain email column
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

// canvas rows that are not students: points, manual posting, "Test Student"
function isCanvasExtra(name: string) {
  const n = name.trim().toLowerCase();
  return n === 'points possible' || n === 'manual posting' || n === 'student, test' || n === 'test student';
}

function parseCanvasRows(body: string[][], idColumn: number, nameColumn: number, emailDomain: string): RosterRow[] {
  const rows: RosterRow[] = [];

  body.forEach((r, i) => {
    if (r.every((c) => c.trim() === '')) return; // blank line
    if (isCanvasExtra(r[nameColumn] ?? '')) return;

    const id = (r[idColumn] ?? '').trim().toLowerCase();
    if (!id) {
      rows.push({ row: i + 2, email: '', problem: 'no login id' });
      return;
    }
    // a login id that's already an email is used as is
    rows.push({ row: i + 2, email: id.includes('@') ? id : `${id}@${emailDomain}`, name: toName(r[nameColumn] ?? '') });
  });
  return rows;
}

// canvas writes "Last, First", no comma means it's already in order
function toName(cell: string): string | undefined {
  const text = cell.trim();
  if (!text) return undefined;
  const [last, ...first] = text.split(',').map((p) => p.trim());
  return first.length ? `${first.join(' ')} ${last}` : text;
}
