// Keyboard movement around the sheet.

import { parseAddress } from './address';

export interface Cursor {
  col: number;
  row: number;
}

export type MoveKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Enter' | 'Tab';

const STEPS: Record<MoveKey, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  Enter: [0, 1],
  Tab: [1, 0],
};

const clamp = (value: number, max: number) => Math.min(Math.max(value, 0), max - 1);

export function move(
  cursor: Cursor,
  key: MoveKey,
  shift: boolean,
  bounds: { cols: number; rows: number }
): Cursor {
  const [dc, dr] = STEPS[key];
  // Shift reverses Enter and Tab; Shift+arrow extends the selection, which the sheet state handles itself.
  const sign = shift && (key === 'Enter' || key === 'Tab') ? -1 : 1;
  return {
    col: clamp(cursor.col + dc * sign, bounds.cols),
    row: clamp(cursor.row + dr * sign, bounds.rows),
  };
}

export type ArrowKey = 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight';

// Ctrl+arrow, as in Excel: inside a block of filled cells, go to its last cell; otherwise go to the next filled
// cell, or to the sheet edge when there is none.
export function jump(
  cursor: Cursor,
  key: ArrowKey,
  filled: (col: number, row: number) => boolean,
  bounds: { cols: number; rows: number }
): Cursor {
  const [dc, dr] = STEPS[key];
  const inside = (c: Cursor) => c.col >= 0 && c.row >= 0 && c.col < bounds.cols && c.row < bounds.rows;
  const step = (c: Cursor): Cursor => ({ col: c.col + dc, row: c.row + dr });
  const isFilled = (c: Cursor) => filled(c.col, c.row);

  let next = step(cursor);
  if (!inside(next)) return cursor;
  if (isFilled(cursor) && isFilled(next)) {
    while (inside(step(next)) && isFilled(step(next))) next = step(next);
    return next;
  }
  while (!isFilled(next) && inside(step(next))) next = step(next);
  return next;
}

// Ctrl+End, as in Excel: the last used row and the last used column (A1 for an empty sheet).
export function lastUsedCell(addresses: Iterable<string>): Cursor {
  let col = 0;
  let row = 0;
  for (const address of addresses) {
    const cell = parseAddress(address);
    if (!cell) continue;
    col = Math.max(col, cell.col);
    row = Math.max(row, cell.row);
  }
  return { col, row };
}
