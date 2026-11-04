// Turns a query result into the header and rows the sheet shows.

import { SHEET_COLUMNS } from './sales-query';

export type Cell = string | number | null;

export interface SheetData {
  header: string[];
  rows: Cell[][];
  truncated: boolean;
}

export const MAX_ROWS = 5000;

function columnName(name: string): string {
  return name.replace(/^\[(.*)\]$/, '$1');
}

function toCell(value: unknown): Cell {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' || typeof value === 'string') return value;
  return String(value);
}

export function toSheetData(table: {
  columns: { name: string }[];
  rows: unknown[][];
}): SheetData {
  // The connector may return no columns at all for an empty result.
  if (table.rows.length === 0) return { header: [...SHEET_COLUMNS], rows: [], truncated: false };
  const names = table.columns.map((c) => columnName(c.name));
  const indexes = SHEET_COLUMNS.map((name) => names.indexOf(name));
  const missing = SHEET_COLUMNS.filter((_, i) => indexes[i] === -1);
  if (missing.length > 0) {
    throw new Error(`Unexpected columns: missing ${missing.join(', ')}`);
  }
  return {
    header: [...SHEET_COLUMNS],
    rows: table.rows.slice(0, MAX_ROWS).map((row) => indexes.map((i) => toCell(row[i]))),
    truncated: table.rows.length > MAX_ROWS,
  };
}
