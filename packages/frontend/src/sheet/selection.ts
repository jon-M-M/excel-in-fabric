// A rectangular selection of cells and the Average / Count / Sum the status bar shows for it.

import { toAddress } from './address';
import { isError, type CellValue } from './formula';
import type { Cursor } from './navigation';

// 0-based, inclusive on every side.
export interface CellRange {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RangeSummary {
  count: number;
  sum?: number;
  average?: number;
}

export function rangeBetween(a: Cursor, b: Cursor): CellRange {
  return {
    left: Math.min(a.col, b.col),
    top: Math.min(a.row, b.row),
    right: Math.max(a.col, b.col),
    bottom: Math.max(a.row, b.row),
  };
}

export function inRange(range: CellRange, col: number, row: number): boolean {
  return col >= range.left && col <= range.right && row >= range.top && row <= range.bottom;
}

export function isSingleCell(range: CellRange): boolean {
  return range.left === range.right && range.top === range.bottom;
}

// As Excel: Count is every non-empty cell; Average and Sum only when there are numbers and no errors.
// Undefined for a single cell or a range of blank cells.
export function summarizeRange(
  range: CellRange,
  values: ReadonlyMap<string, CellValue>
): RangeSummary | undefined {
  if (isSingleCell(range)) return undefined;
  let count = 0;
  let numbers = 0;
  let sum = 0;
  let errored = false;
  for (let row = range.top; row <= range.bottom; row++) {
    for (let col = range.left; col <= range.right; col++) {
      const value = values.get(toAddress(col, row));
      if (value === undefined || value === null) continue;
      count++;
      if (isError(value)) errored = true;
      else if (typeof value === 'number') {
        numbers++;
        sum += value;
      }
    }
  }
  // Nothing to report for blank cells; the status bar then looks as it does for a single cell.
  if (count === 0) return undefined;
  return numbers === 0 || errored ? { count } : { count, sum, average: sum / numbers };
}

export function formatStatusNumber(value: number): string {
  return Number(value.toPrecision(10)).toLocaleString('en-US', { maximumFractionDigits: 10 });
}
