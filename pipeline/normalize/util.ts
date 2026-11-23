/** Small pure helpers shared by the table builders. */
import { createHash } from 'node:crypto';

import { foldName, nameParts } from './names.ts';

export type CsvValue = string | number | boolean | undefined | null;

function csvCell(value: CsvValue): string {
  if (value === undefined || value === null) return '';
  const text = typeof value === 'string' ? value : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * RFC 4180 CSV with a header, LF line endings and no BOM. Rows are sorted by the
 * given key columns so that a run on unchanged data writes identical bytes.
 */
export function toCsv<T extends Record<string, CsvValue>>(
  columns: readonly (keyof T & string)[],
  rows: readonly T[],
  keyColumns: readonly (keyof T & string)[],
): string {
  const keyOf = (row: T) => keyColumns.map((column) => String(row[column] ?? '')).join('\u0000');
  const sorted = [...rows].sort((a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
  const lines = [columns.join(',')];
  for (const row of sorted) lines.push(columns.map((column) => csvCell(row[column])).join(','));
  return `${lines.join('\n')}\n`;
}

/** "dd/mm/yyyy" or "d/m/yyyy" -> "yyyy-mm-dd"; empty or undefined -> undefined. */
export function isoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new Error(`Unexpected date: ${value}`);
  const [, day = '', month = '', year = ''] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Collapses whitespace, including the line breaks inside many official texts. */
export function clean(text: string | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Stable internal key: legislature + SHA-256 of the folded census name (decision D-008). */
export function diputadoId(legislatura: number, censusName: string): string {
  const digest = createHash('sha256')
    .update(`${legislatura}|${foldName(censusName)}`)
    .digest('hex');
  return `L${legislatura}-${digest.slice(0, 10)}`;
}

/** "Abascal Conde, Santiago" -> "santiago-abascal-conde". */
export function slugFromName(censusName: string): string {
  const [surnames = '', given = ''] = censusName.split(',', 2);
  return foldName(`${given} ${surnames}`).replace(/ /g, '-');
}

/** Given names and surnames as written ("Apellidos, Nombre"). */
export function splitCensusName(censusName: string): { nombre: string; apellidos: string } {
  const [apellidos = '', nombre = ''] = censusName.split(',', 2).map((part) => part.trim());
  return { nombre, apellidos };
}

/** True when the folded surnames of two names are equal (used only in error messages). */
export function sameSurnames(a: string, b: string): boolean {
  return nameParts(a).surnames.join(' ') === nameParts(b).surnames.join(' ');
}

/**
 * Parses the CSV written by `toCsv` (RFC 4180, LF or CRLF line endings) into records
 * keyed by the header. Every value is a string; an empty cell is ''.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    let field: string;
    if (text[i] === '"') {
      let out = '';
      let j = i + 1;
      for (;;) {
        const quote = text.indexOf('"', j);
        if (quote === -1) throw new Error('Unterminated quoted CSV field');
        if (text[quote + 1] === '"') {
          out += text.slice(j, quote + 1);
          j = quote + 2;
          continue;
        }
        out += text.slice(j, quote);
        i = quote + 1;
        break;
      }
      field = out;
    } else {
      let j = i;
      while (j < n && text[j] !== ',' && text[j] !== '\n') j++;
      field = text.slice(i, j);
      if (field.endsWith('\r')) field = field.slice(0, -1);
      i = j;
    }
    row.push(field);
    if (text[i] === '\r') i++;
    if (i >= n) {
      rows.push(row);
      break;
    }
    if (text[i] === ',') {
      i++;
      if (i === n) {
        row.push('');
        rows.push(row);
      }
      continue;
    }
    if (text[i] === '\n') {
      i++;
      rows.push(row);
      row = [];
      continue;
    }
    throw new Error(`Unexpected character after a quoted CSV field at offset ${i}`);
  }
  const header = rows[0] ?? [];
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((column, index) => {
      record[column] = cells[index] ?? '';
    });
    return record;
  });
}
