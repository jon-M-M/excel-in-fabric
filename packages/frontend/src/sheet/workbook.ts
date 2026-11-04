// The sheet's cells: what the user typed, recalculation, sorting the data block and AutoSum.

import type { SheetData } from '@/handoff/sheet-data';

import { COLUMN_COUNT, columnLetter, toAddress } from './address';
import { evaluateFormula, isError, isFormula, type CellValue } from './formula';
import { mapReferences } from './references';
import type { CellRange } from './selection';

export type Raw = string | number | null;

export interface Workbook {
  readonly cells: ReadonlyMap<string, Raw>;
  readonly rowCount: number;
  readonly dataRows: number;
}

export const EXTRA_ROWS = 50;

export function workbookFromSheetData(data: SheetData): Workbook {
  const cells = new Map<string, Raw>();
  [data.header, ...data.rows].forEach((row, r) =>
    row.forEach((cell, c) => {
      if (cell !== null && cell !== '') cells.set(toAddress(c, r), cell);
    })
  );
  const dataRows = data.rows.length + 1;
  return { cells, rowCount: dataRows + EXTRA_ROWS, dataRows };
}

export function emptyWorkbook(): Workbook {
  return { cells: new Map(), rowCount: 100, dataRows: 0 };
}

const PLAIN_NUMBER = /^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

export function setCell(wb: Workbook, col: number, row: number, input: string): Workbook {
  const cells = new Map(wb.cells);
  const address = toAddress(col, row);
  const text = input.trim();
  if (text === '') cells.delete(address);
  else if (isFormula(text)) cells.set(address, text);
  else if (PLAIN_NUMBER.test(text)) cells.set(address, Number(text));
  else cells.set(address, input);
  return { ...wb, cells };
}

export function clearRange(wb: Workbook, range: CellRange): Workbook {
  const cells = new Map(wb.cells);
  for (let row = range.top; row <= range.bottom; row++) {
    for (let col = range.left; col <= range.right; col++) cells.delete(toAddress(col, row));
  }
  return { ...wb, cells };
}

export function rawText(wb: Workbook, col: number, row: number): string {
  const raw = wb.cells.get(toAddress(col, row));
  return raw === undefined || raw === null ? '' : String(raw);
}

export function computeValues(wb: Workbook): ReadonlyMap<string, CellValue> {
  const values = new Map<string, CellValue>();
  const visiting = new Set<string>();

  const valueOf = (address: string): CellValue => {
    const known = values.get(address);
    if (known !== undefined) return known;
    const raw = wb.cells.get(address);
    if (raw === undefined || raw === null) return null;
    if (!isFormula(raw)) return raw;
    // Reaching a cell that is still being evaluated means a cycle.
    if (visiting.has(address)) return { error: '#CIRC!' };
    visiting.add(address);
    const value = evaluateFormula(raw, (c, r) => valueOf(toAddress(c, r)));
    visiting.delete(address);
    values.set(address, value);
    return value;
  };

  for (const address of wb.cells.keys()) values.set(address, valueOf(address));
  return values;
}

export function displayText(value: CellValue | undefined): string {
  if (value === undefined || value === null) return '';
  if (isError(value)) return value.error;
  if (typeof value === 'number') return String(Number(value.toPrecision(10)));
  return value;
}

// Numbers sort before text; blanks go last in either direction.
function compare(a: CellValue | undefined, b: CellValue | undefined, direction: 'asc' | 'desc'): number {
  const rank = (v: CellValue | undefined) =>
    v === undefined || v === null ? 2 : typeof v === 'number' ? 0 : 1;
  const [ra, rb] = [rank(a), rank(b)];
  if (ra === 2 || rb === 2) return ra - rb;
  const sign = direction === 'asc' ? 1 : -1;
  if (ra !== rb) return (ra - rb) * sign;
  if (typeof a === 'number' && typeof b === 'number') return (a - b) * sign;
  return displayText(a ?? null).localeCompare(displayText(b ?? null)) * sign;
}

// A formula moving from one row of the data block to another keeps pointing at its own row:
// relative row references into the block shift by the move, as when Excel sorts. Text in quotes is left alone.
function shiftFormula(formula: string, delta: number, firstRow: number, lastRow: number): string {
  if (delta === 0) return formula;
  return mapReferences(formula, (ref) =>
    ref.rowAbs || ref.row < firstRow || ref.row > lastRow ? ref : { ...ref, row: ref.row + delta }
  );
}

export function sortDataBlock(wb: Workbook, col: number, direction: 'asc' | 'desc'): Workbook {
  const firstRow = 1;
  const lastRow = wb.dataRows - 1;
  if (lastRow <= firstRow) return wb;
  const values = computeValues(wb);
  const rows = Array.from({ length: lastRow - firstRow + 1 }, (_, i) => {
    const row = firstRow + i;
    return {
      row,
      key: values.get(toAddress(col, row)),
      cells: Array.from({ length: COLUMN_COUNT }, (_, c) => wb.cells.get(toAddress(c, row))),
    };
  });
  rows.sort((a, b) => compare(a.key, b.key, direction));
  const cells = new Map(wb.cells);
  rows.forEach(({ row: from, cells: rowCells }, i) => {
    const to = firstRow + i;
    rowCells.forEach((raw, c) => {
      const address = toAddress(c, to);
      if (raw === undefined || raw === null) cells.delete(address);
      else cells.set(address, isFormula(raw) ? shiftFormula(raw, to - from, firstRow, lastRow) : raw);
    });
  });
  return { ...wb, cells };
}

export function autoSumFormula(
  wb: Workbook,
  values: ReadonlyMap<string, CellValue>,
  col: number,
  row: number
): string | undefined {
  if (row >= wb.rowCount) return undefined;
  let top = row;
  while (top > 0 && typeof values.get(toAddress(col, top - 1)) === 'number') top--;
  if (top === row) return undefined;
  const letter = columnLetter(col);
  return `=SUM(${letter}${top + 1}:${letter}${row})`;
}
