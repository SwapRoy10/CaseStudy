// collaborative code by somesh and claude sonnet 5.5

// csv text to rows of cells, handles quoted commas like "Rivera, Alex"
export function parseCsv(text: string): string[][] {
  // drop the byte order mark excel adds
  const input = text.replace(/^﻿/, '');

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"'; // doubled quote is one quote character
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell); // comma outside quotes ends the cell
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      // \r\n is one line break
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  // last line may have no line break
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  // blank lines stay so the index matches the sheet row number
  return rows;
}
