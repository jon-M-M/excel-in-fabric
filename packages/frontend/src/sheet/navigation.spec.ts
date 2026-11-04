import { describe, expect, it } from 'vitest';

import { jump, lastUsedCell, move } from './navigation';

const bounds = { cols: 26, rows: 10 };

describe('move', () => {
  it('stays put at the top-left edge', () => {
    expect(move({ col: 0, row: 0 }, 'ArrowUp', false, bounds)).toEqual({ col: 0, row: 0 });
    expect(move({ col: 0, row: 0 }, 'ArrowLeft', false, bounds)).toEqual({ col: 0, row: 0 });
  });

  it('moves down on Enter and up on Shift+Enter', () => {
    expect(move({ col: 0, row: 0 }, 'Enter', false, bounds)).toEqual({ col: 0, row: 1 });
    expect(move({ col: 0, row: 1 }, 'Enter', true, bounds)).toEqual({ col: 0, row: 0 });
  });

  it('moves right on Tab and left on Shift+Tab', () => {
    expect(move({ col: 0, row: 0 }, 'Tab', false, bounds)).toEqual({ col: 1, row: 0 });
    expect(move({ col: 1, row: 0 }, 'Tab', true, bounds)).toEqual({ col: 0, row: 0 });
  });

  it('clamps at the right and bottom edges', () => {
    expect(move({ col: 25, row: 0 }, 'ArrowRight', false, bounds)).toEqual({ col: 25, row: 0 });
    expect(move({ col: 0, row: 9 }, 'ArrowDown', false, bounds)).toEqual({ col: 0, row: 9 });
  });
});

describe('jump (Ctrl+arrow)', () => {
  // A column with data in rows 0–4, a gap, then data in rows 7–8.
  const filledRows = new Set([0, 1, 2, 3, 4, 7, 8]);
  const filled = (col: number, row: number) => col === 0 && filledRows.has(row);

  it('goes to the last filled cell of the block it is in', () => {
    expect(jump({ col: 0, row: 0 }, 'ArrowDown', filled, bounds)).toEqual({ col: 0, row: 4 });
  });

  it('goes from the end of a block to the start of the next one', () => {
    expect(jump({ col: 0, row: 4 }, 'ArrowDown', filled, bounds)).toEqual({ col: 0, row: 7 });
  });

  it('goes from an empty cell to the next filled cell', () => {
    expect(jump({ col: 0, row: 5 }, 'ArrowDown', filled, bounds)).toEqual({ col: 0, row: 7 });
  });

  it('goes to the sheet edge when nothing filled lies ahead', () => {
    expect(jump({ col: 0, row: 8 }, 'ArrowDown', filled, bounds)).toEqual({ col: 0, row: 9 });
    expect(jump({ col: 1, row: 3 }, 'ArrowRight', filled, bounds)).toEqual({ col: 25, row: 3 });
  });

  it('works upwards and stays put at the edge', () => {
    expect(jump({ col: 0, row: 8 }, 'ArrowUp', filled, bounds)).toEqual({ col: 0, row: 7 });
    expect(jump({ col: 0, row: 3 }, 'ArrowUp', filled, bounds)).toEqual({ col: 0, row: 0 });
    expect(jump({ col: 0, row: 0 }, 'ArrowUp', filled, bounds)).toEqual({ col: 0, row: 0 });
  });

  it('a single filled cell next to a gap jumps across the gap', () => {
    expect(jump({ col: 0, row: 7 }, 'ArrowUp', filled, bounds)).toEqual({ col: 0, row: 4 });
  });
});

describe('lastUsedCell (Ctrl+End)', () => {
  it('is the last used row and the last used column', () => {
    expect(lastUsedCell(['A1', 'C2', 'B5'])).toEqual({ col: 2, row: 4 });
  });

  it('is A1 for an empty sheet', () => {
    expect(lastUsedCell([])).toEqual({ col: 0, row: 0 });
  });
});
