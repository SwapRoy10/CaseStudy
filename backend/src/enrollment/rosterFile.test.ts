// collaborative code by the group and claude sonnet 5.5

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ValidationError } from '../errors';
import { parseRosterFile } from './rosterFile';

const DOMAIN = 'case.edu';

describe('parseRosterFile, canvas gradebook export', () => {
  const header = 'Student,ID,SIS User ID,SIS Login ID,Section,Assignment 1 (1001)';

  it('builds the school email from the login id', () => {
    const csv = [header, '"Rivera, Alex",1,2,axr101,A,90'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)).toEqual([{ row: 2, email: 'axr101@case.edu', name: 'Alex Rivera' }]);
  });

  it('uses a login id that is already an email as is', () => {
    const csv = [header, '"Rivera, Alex",1,2,Alex@Other.edu,A,90'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)[0].email).toBe('alex@other.edu');
  });

  it('uses the domain from config', () => {
    const csv = [header, '"Rivera, Alex",1,2,axr101,A,90'].join('\n');
    expect(parseRosterFile(csv, 'school.test')[0].email).toBe('axr101@school.test');
  });

  it('skips the points possible row, the manual posting row and the test student', () => {
    const csv = [
      header,
      '    Points Possible,,,,,100',
      '    Manual Posting,,,,,',
      '"Student, Test",99,,,A,',
      '"Rivera, Alex",1,2,axr101,A,90',
    ].join('\n');
    expect(parseRosterFile(csv, DOMAIN)).toEqual([{ row: 5, email: 'axr101@case.edu', name: 'Alex Rivera' }]);
  });

  it('flags a student with no login id instead of skipping them', () => {
    const csv = [header, '"Rivera, Alex",1,2,,A,90'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)).toEqual([{ row: 2, email: '', problem: 'no login id' }]);
  });

  it('numbers rows the way excel does, blank lines included', () => {
    const csv = [header, '', '"Rivera, Alex",1,2,axr101,A,90'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)[0].row).toBe(3);
  });

  it('works with windows line breaks and a byte order mark', () => {
    const csv = '﻿' + [header, '"Rivera, Alex",1,2,axr101,A,90'].join('\r\n') + '\r\n';
    expect(parseRosterFile(csv, DOMAIN)).toEqual([{ row: 2, email: 'axr101@case.edu', name: 'Alex Rivera' }]);
  });

  it('accepts a plain email column too', () => {
    const csv = ['Name,Email', 'Alex,axr101@case.edu'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)).toEqual([{ row: 2, email: 'axr101@case.edu', name: 'Alex' }]);
  });

  it('reads the sample export in the database folder', () => {
    const csv = readFileSync(join(__dirname, '../../../database/sample-canvas-roster.csv'), 'utf8');
    const rows = parseRosterFile(csv, DOMAIN);
    // 36 students, and the points row and test student are left out
    expect(rows).toHaveLength(36);
    expect(rows.every((r) => !r.problem && r.email.endsWith('@case.edu'))).toBe(true);
    expect(rows[0]).toEqual({ row: 3, email: 'mxc1001@case.edu', name: 'Maya Chen' });
  });

  it('turns Last, First into First Last, and leaves a name without a comma alone', () => {
    const csv = [header, '"Van Der Berg, Jan Willem",1,2,jvb1,A,', 'Cher,3,4,cher2,A,'].join('\n');
    expect(parseRosterFile(csv, DOMAIN).map((r) => r.name)).toEqual(['Jan Willem Van Der Berg', 'Cher']);
  });

  it('has no name when the cell is empty', () => {
    const csv = [header, ',1,2,axr101,A,'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)[0].name).toBeUndefined();
  });

  it('rejects a file with no login id or email column', () => {
    expect(() => parseRosterFile('Student,Section\nAlex,A', DOMAIN)).toThrow(ValidationError);
    expect(() => parseRosterFile('', DOMAIN)).toThrow(ValidationError);
  });
});

describe('parseRosterFile, sdd format', () => {
  const header = 'course_code,section,term,school_email';

  it('reads the course and email from every row', () => {
    const csv = [header, 'CSDS 393,100,Fall 2026,AXR101@case.edu'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)).toEqual([
      { row: 2, email: 'axr101@case.edu', course: { code: 'CSDS 393', section: '100', term: 'Fall 2026' } },
    ]);
  });

  it('finds the columns by name, in any order', () => {
    const csv = ['school_email,term,section,course_code', 'axr101@case.edu,Fall 2026,100,CSDS 393'].join('\n');
    expect(parseRosterFile(csv, DOMAIN)[0].course).toEqual({ code: 'CSDS 393', section: '100', term: 'Fall 2026' });
  });

  it('skips blank lines but keeps the row numbers', () => {
    const csv = [header, '', 'CSDS 393,100,Fall 2026,axr101@case.edu', ',,,'].join('\n');
    expect(parseRosterFile(csv, DOMAIN).map((r) => r.row)).toEqual([3]);
  });
});
