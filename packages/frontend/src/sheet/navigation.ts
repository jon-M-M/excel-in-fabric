// Keyboard movement around the sheet.

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
