import { describe, expect, it } from 'vitest';

import type { CellValue } from './formula';
import { formatStatusNumber, inRange, isSingleCell, rangeBetween, summarizeRange } from './selection';

const values = (entries: Record<string, CellValue>) => new Map(Object.entries(entries));
const A1_A3 = rangeBetween({ col: 0, row: 0 }, { col: 0, row: 2 });

describe('rangeBetween', () => {
  it('normalises corners', () => {
    const expected = { left: 1, top: 2, right: 3, bottom: 5 };
    expect(rangeBetween({ col: 3, row: 5 }, { col: 1, row: 2 })).toEqual(expected);
    expect(rangeBetween({ col: 1, row: 2 }, { col: 3, row: 5 })).toEqual(expected);
  });
});

describe('inRange', () => {
  it('includes edges', () => {
    const range = rangeBetween({ col: 3, row: 5 }, { col: 1, row: 2 });
    expect(inRange(range, 1, 2)).toBe(true);
    expect(inRange(range, 3, 5)).toBe(true);
    expect(inRange(range, 0, 2)).toBe(false);
    expect(inRange(range, 3, 6)).toBe(false);
  });
});

describe('isSingleCell', () => {
  it('is true only for one cell', () => {
    const c = { col: 2, row: 4 };
    expect(isSingleCell(rangeBetween(c, c))).toBe(true);
    expect(isSingleCell(rangeBetween(c, { col: 3, row: 4 }))).toBe(false);
  });
});

describe('summarizeRange', () => {
  it('summarizes numbers', () => {
    expect(summarizeRange(A1_A3, values({ A1: 10, A2: 20, A3: 30 }))).toEqual({ count: 3, sum: 60, average: 20 });
  });

  it('counts text but sums only numbers', () => {
    expect(summarizeRange(A1_A3, values({ A1: 'North', A2: 5, A3: 7 }))).toEqual({ count: 3, sum: 12, average: 6 });
  });

  it('counts empty cells as nothing', () => {
    const range = rangeBetween({ col: 0, row: 0 }, { col: 1, row: 2 });
    expect(summarizeRange(range, values({ A1: 4, B2: null }))).toEqual({ count: 1, sum: 4, average: 4 });
  });

  it('text only gives count only', () => {
    expect(summarizeRange(A1_A3, values({ A1: 'a', A2: 'b' }))).toEqual({ count: 2 });
  });

  it('hides sum and average when the range has an error', () => {
    expect(summarizeRange(A1_A3, values({ A1: 1, A2: { error: '#DIV/0!' } }))).toEqual({ count: 2 });
  });

  it('an empty range gives undefined', () => {
    expect(summarizeRange(A1_A3, values({ B1: 5 }))).toBeUndefined();
  });

  it('single cell gives undefined', () => {
    const c = { col: 0, row: 0 };
    expect(summarizeRange(rangeBetween(c, c), values({ A1: 5 }))).toBeUndefined();
  });
});

describe('formatStatusNumber', () => {
  it('formats like the Excel status bar', () => {
    expect(formatStatusNumber(880362)).toBe('880,362');
    expect(formatStatusNumber(183.41666666666666)).toBe('183.4166667');
    expect(formatStatusNumber(-1234.5)).toBe('-1,234.5');
    expect(formatStatusNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatStatusNumber(0)).toBe('0');
  });
});
