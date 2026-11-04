// Reads a CSV file into the sheet: first row is the header, plain numbers become numbers.

import Papa from 'papaparse';

import { MAX_ROWS, type Cell, type SheetData } from '@/handoff/sheet-data';

import { COLUMN_COUNT } from './address';

export type CsvResult =
  | { kind: 'loaded'; data: SheetData; droppedColumns: number }
  | { kind: 'empty' }
  | { kind: 'invalid'; reason: string };

// Byte-order mark that Excel writes at the start of UTF-8 CSV files.
const BOM = String.fromCharCode(0xfeff);
const NUL = String.fromCharCode(0);
const ZIP_SIGNATURE = 'PK' + String.fromCharCode(3, 4);
const PLAIN_NUMBER = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;
// "00123" is a code, not a number: Excel would drop the zeros, which loses data.
const LEADING_ZERO = /^-?0\d/;

function toCell(field: string | undefined): Cell {
  if (field === undefined || field === '') return null;
  const text = field.trim();
  const number = Number(text);
  return PLAIN_NUMBER.test(text) && !LEADING_ZERO.test(text) && Number.isFinite(number) ? number : field;
}

export function parseCsv(text: string): CsvResult {
  // A spreadsheet, image or other binary file picked by mistake reads as junk text.
  if (text.includes(NUL) || text.startsWith(ZIP_SIGNATURE)) {
    return { kind: 'invalid', reason: "this file isn't a CSV" };
  }
  const parsed = Papa.parse<string[]>((text.startsWith(BOM) ? text.slice(1) : text), { skipEmptyLines: 'greedy' });
  // Ragged rows and an undetectable delimiter (a one-column file; comma is assumed) aren't fatal.
  const fatal = parsed.errors.find((error) => error.type !== 'FieldMismatch' && error.type !== 'Delimiter');
  if (fatal) return { kind: 'invalid', reason: fatal.message };

  const [header, ...body] = parsed.data;
  if (!header) return { kind: 'empty' };

  const widest = Math.max(header.length, ...body.slice(0, MAX_ROWS).map((row) => row.length));
  const width = Math.min(widest, COLUMN_COUNT);
  const pad = <T,>(row: T[], fill: T) => Array.from({ length: width }, (_, i) => row[i] ?? fill);

  return {
    kind: 'loaded',
    droppedColumns: Math.max(0, widest - COLUMN_COUNT),
    data: {
      header: pad(header, ''),
      rows: body.slice(0, MAX_ROWS).map((row) => pad(row.map(toCell), null)),
      truncated: body.length > MAX_ROWS,
    },
  };
}

export function csvWorkbookName(fileName: string): string {
  return fileName.replace(/\.csv$/i, '');
}
