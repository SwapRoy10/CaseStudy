// collaborative code by the group and claude sonnet 5.5

import { describe, expect, it } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('splits rows and cells', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('keeps a comma inside quotes in one cell', () => {
    expect(parseCsv('name,id\n"Rivera, Alex",101')).toEqual([['name', 'id'], ['Rivera, Alex', '101']]);
  });

  it('reads a doubled quote inside quotes as one quote', () => {
    expect(parseCsv('"say ""hi"""')).toEqual([['say "hi"']]);
  });

  it('keeps a line break inside quotes', () => {
    expect(parseCsv('"two\nlines",x')).toEqual([['two\nlines', 'x']]);
  });

  it('handles windows line breaks', () => {
    expect(parseCsv('a,b\r\n1,2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('drops the byte order mark excel adds', () => {
    expect(parseCsv('﻿a,b')).toEqual([['a', 'b']]);
  });

  it('keeps empty cells', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('works when the last line has no line break', () => {
    expect(parseCsv('a\nb')).toEqual([['a'], ['b']]);
  });

  it('keeps blank lines so row numbers still match the sheet', () => {
    expect(parseCsv('a\n\nb')).toHaveLength(3);
  });

  it('gives no rows for an empty file', () => {
    expect(parseCsv('')).toEqual([]);
  });
});
