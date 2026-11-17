// reads csv text into rows of cells. canvas puts names like "Rivera, Alex" in
// quotes, so splitting on commas isn't enough: a comma inside quotes belongs to
// the cell, and a doubled quote ("") inside quotes is one quote character.
export function parseCsv(text: string): string[][] {
  // excel saves a byte order mark at the start of the file, drop it
  const input = text.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // \r\n counts as one line break
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  // the last line may not end with a line break
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // blank lines are kept so a row's position here is its row number in the sheet
  return rows;
}
