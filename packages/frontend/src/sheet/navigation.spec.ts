import { describe, expect, it } from 'vitest';

import { move } from './navigation';

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
