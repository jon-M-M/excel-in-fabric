// Excel's fill handle: which cells a drag covers, and copying the selected block into them.

import { toAddress } from './address';
import { isFormula } from './formula';
import type { Cursor } from './navigation';
import { shiftReferences } from './references';
import { inRange, type CellRange } from './selection';
import type { Workbook } from './workbook';

// How far a position lies outside [low, high]: negative before it, positive after it, 0 inside.
function outside(value: number, low: number, high: number): number {
  return value < low ? value - low : value > high ? value - high : 0;
}

// The source plus the cells towards the pointer, along whichever axis it has moved further (down on a tie).
export function fillExtent(source: CellRange, target: Cursor): CellRange | undefined {
  const rows = outside(target.row, source.top, source.bottom);
  const cols = outside(target.col, source.left, source.right);
  if (rows === 0 && cols === 0) return undefined;
  if (Math.abs(rows) >= Math.abs(cols)) {
    return rows < 0 ? { ...source, top: target.row } : { ...source, bottom: target.row };
  }
  return cols < 0 ? { ...source, left: target.col } : { ...source, right: target.col };
}

const modulo = (n: number, size: number) => ((n % size) + size) % size;

// Repeats the source block across the extent, lined up with the source's top-left; formulas move their
// references with them, and an empty source cell clears its target.
export function fillRange(wb: Workbook, source: CellRange, extent: CellRange): Workbook {
  const height = source.bottom - source.top + 1;
  const width = source.right - source.left + 1;
  const cells = new Map(wb.cells);
  for (let row = extent.top; row <= extent.bottom; row++) {
    for (let col = extent.left; col <= extent.right; col++) {
      if (inRange(source, col, row)) continue;
      const fromRow = source.top + modulo(row - source.top, height);
      const fromCol = source.left + modulo(col - source.left, width);
      const raw = wb.cells.get(toAddress(fromCol, fromRow));
      const address = toAddress(col, row);
      if (raw === undefined || raw === null) cells.delete(address);
      else cells.set(address, isFormula(raw) ? shiftReferences(raw, row - fromRow, col - fromCol) : raw);
    }
  }
  return { ...wb, cells };
}

// Double-click on the handle: down as far as the column on the left has values, without a gap.
export function fillDownExtent(wb: Workbook, source: CellRange): CellRange | undefined {
  if (source.left === 0) return undefined;
  let bottom = source.bottom;
  while (bottom + 1 < wb.rowCount) {
    const beside = wb.cells.get(toAddress(source.left - 1, bottom + 1));
    if (beside === undefined || beside === null || beside === '') break;
    bottom++;
  }
  return bottom === source.bottom ? undefined : { ...source, bottom };
}
