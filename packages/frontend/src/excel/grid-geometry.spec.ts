import { describe, expect, it } from 'vitest';

import type { CellValue } from '@/sheet/formula';

import { autoFitWidth, clampColumnWidth, columnLeft, columnWidth } from './grid-geometry';

const values = (entries: Record<string, CellValue>) => new Map(Object.entries(entries));
const measure = (text: string) => text.length * 7;

describe('grid geometry', () => {
  it('columnWidth uses the default', () => {
    expect(columnWidth(new Map(), 3)).toBe(96);
    expect(columnWidth(new Map([[3, 150]]), 3)).toBe(150);
  });

  it('columnLeft adds preceding widths', () => {
    expect(columnLeft(0, new Map())).toBe(48);
    expect(columnLeft(2, new Map([[1, 200]]))).toBe(344);
    expect(columnLeft(26, new Map())).toBe(48 + 26 * 96);
  });

  it('clampColumnWidth', () => {
    expect(clampColumnWidth(5)).toBe(20);
    expect(clampColumnWidth(1000)).toBe(600);
    expect(clampColumnWidth(150.6)).toBe(151);
  });

  it('autoFitWidth measures the widest value', () => {
    const v = values({ F1: 'Sales Amount', F2: 90, F10: 1234567, G1: 'a much longer text in G' });
    expect(autoFitWidth(v, 5, measure)).toBe(12 * 7 + 8);
  });

  it('autoFitWidth shows errors as text', () => {
    expect(autoFitWidth(values({ F1: { error: '#DIV/0!' } }), 5, measure)).toBe(7 * 7 + 8);
  });

  it('autoFitWidth clamps', () => {
    expect(autoFitWidth(values({ F1: 'x'.repeat(200) }), 5, measure)).toBe(600);
    expect(autoFitWidth(values({ F1: 'a' }), 5, measure)).toBe(20);
  });

  it('autoFitWidth of an empty column is the default', () => {
    expect(autoFitWidth(values({ A1: 'x' }), 5, measure)).toBe(96);
  });
});
