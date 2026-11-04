import { describe, expect, it } from 'vitest';

import { canPoint, insertReference, rangeText, type PointRef } from './point-mode';

const pointedF2: PointRef = { start: 1, end: 3, anchor: { col: 5, row: 1 } };

describe('rangeText', () => {
  it('writes a cell or a top-left:bottom-right range', () => {
    expect(rangeText({ col: 2, row: 1 }, { col: 2, row: 1 })).toBe('C2');
    expect(rangeText({ col: 3, row: 9 }, { col: 2, row: 1 })).toBe('C2:D10');
  });
});

describe('canPoint', () => {
  it('after an operator', () => {
    expect(canPoint('=', 1)).toBe(true);
    expect(canPoint('=A1+', 4)).toBe(true);
    expect(canPoint('=SUM(', 5)).toBe(true);
    expect(canPoint('=SUM(A1,', 8)).toBe(true);
    expect(canPoint('=A1 * ', 6)).toBe(true);
  });

  it('not where a reference would not fit', () => {
    expect(canPoint('=A1', 3)).toBe(false);
    expect(canPoint('=SUM(A1)', 8)).toBe(false);
    expect(canPoint('A1+', 3)).toBe(false);
    expect(canPoint('=A1+', 2)).toBe(false);
  });

  it('right after a pointed reference', () => {
    expect(canPoint('=F2', 3, pointedF2)).toBe(true);
    expect(canPoint('=F2', 2, pointedF2)).toBe(false);
  });
});

describe('insertReference', () => {
  it('inserts at the caret', () => {
    expect(insertReference('=+B1', 1, 'A1')).toEqual({ text: '=A1+B1', caret: 3, span: { start: 1, end: 3 } });
  });

  it('replaces the pointed reference', () => {
    expect(insertReference('=F2', 3, 'F3', pointedF2)).toEqual({ text: '=F3', caret: 3, span: { start: 1, end: 3 } });
    expect(insertReference('=F2', 3, 'F2:F9', pointedF2)).toEqual({
      text: '=F2:F9',
      caret: 6,
      span: { start: 1, end: 6 },
    });
  });
});

describe('pointing over a selection', () => {
  it('canPoint looks before the selection', () => {
    expect(canPoint('=A1+B1', 4, undefined, 6)).toBe(true);
  });

  it('insertReference replaces the selection', () => {
    expect(insertReference('=A1+B1', 4, 'F3', undefined, 6)).toEqual({
      text: '=A1+F3',
      caret: 6,
      span: { start: 4, end: 6 },
    });
  });
});
