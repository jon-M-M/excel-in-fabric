// Sizes and positions of the grid's rows and columns, and the column-width rules.

import { parseAddress } from '@/sheet/address';
import type { CellValue } from '@/sheet/formula';
import { displayText } from '@/sheet/workbook';

export const ROW_HEIGHT = 20;
export const COLUMN_WIDTH = 96;
export const ROW_HEADER_WIDTH = 48;
export const MIN_COLUMN_WIDTH = 20;
export const MAX_COLUMN_WIDTH = 600;
// Cell padding (3px each side) plus the gridline.
const CELL_CHROME = 8;

// Widths the user set, in px, by 0-based column; other columns are COLUMN_WIDTH wide.
export type ColumnWidths = ReadonlyMap<number, number>;

export function clampColumnWidth(px: number): number {
  return Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(px)));
}

export function columnWidth(widths: ColumnWidths, col: number): number {
  return widths.get(col) ?? COLUMN_WIDTH;
}

// The x offset of a column's left edge inside the grid content; columnLeft(COLUMN_COUNT) is the content width.
export function columnLeft(col: number, widths: ColumnWidths): number {
  let left = ROW_HEADER_WIDTH;
  for (let c = 0; c < col; c++) left += columnWidth(widths, c);
  return left;
}

// Excel's double-click on a column edge: fit the widest displayed value, header included.
export function autoFitWidth(
  values: ReadonlyMap<string, CellValue>,
  col: number,
  measure: (text: string) => number
): number {
  let widest = -1;
  for (const [address, value] of values) {
    if (parseAddress(address)?.col !== col || value === null) continue;
    widest = Math.max(widest, measure(displayText(value)));
  }
  return widest < 0 ? COLUMN_WIDTH : clampColumnWidth(widest + CELL_CHROME);
}
