import { describe, expect, it } from 'vitest';

import type { SheetData } from '@/handoff/sheet-data';

import {
  autoSumFormula,
  clearRange,
  computeValues,
  displayText,
  emptyWorkbook,
  rawText,
  setCell,
  sortDataBlock,
  workbookFromSheetData,
  type Workbook,
} from './workbook';

const HEADER = ['Year', 'Month', 'Region', 'Product', 'Quantity', 'Sales Amount'];

function sheet(amounts: (number | null)[]): SheetData {
  return {
    header: HEADER,
    rows: amounts.map((amount, i) => [2026, 'Jan', 'North', `P${i}`, i, amount]),
    truncated: false,
  };
}

const value = (wb: Workbook, address: string) => computeValues(wb).get(address);
const set = (wb: Workbook, entries: [number, number, string][]) =>
  entries.reduce((acc, [col, row, input]) => setCell(acc, col, row, input), wb);

describe('workbook', () => {
  it('builds from sheet data', () => {
    const wb = workbookFromSheetData(sheet([30, 10, 20]));
    expect(wb.cells.get('A1')).toBe('Year');
    expect(wb.cells.get('F1')).toBe('Sales Amount');
    expect(wb.cells.get('D2')).toBe('P0');
    expect(wb.rowCount).toBe(3 + 1 + 50);
    expect(wb.dataRows).toBe(4);
  });

  it('stores numbers, text and formulas', () => {
    const wb = emptyWorkbook();
    expect(setCell(wb, 0, 0, '12.5').cells.get('A1')).toBe(12.5);
    expect(setCell(wb, 0, 0, '-3').cells.get('A1')).toBe(-3);
    expect(setCell(wb, 0, 0, 'abc').cells.get('A1')).toBe('abc');
    expect(setCell(wb, 0, 0, '=A2*2').cells.get('A1')).toBe('=A2*2');
    const filled = setCell(wb, 0, 0, '1');
    expect(setCell(filled, 0, 0, '').cells.has('A1')).toBe(false);
    expect(wb.cells.has('A1')).toBe(false);
  });

  it('recalculates a chain after an edit', () => {
    const wb = set(emptyWorkbook(), [
      [0, 0, '1'],
      [1, 0, '=A1+1'],
      [2, 0, '=B1*2'],
    ]);
    expect(value(wb, 'C1')).toBe(4);
    expect(value(setCell(wb, 0, 0, '5'), 'C1')).toBe(12);
  });

  it('marks every cell in a cycle', () => {
    const wb = set(emptyWorkbook(), [
      [0, 0, '=B1'],
      [1, 0, '=A1'],
      [2, 0, '=A1+1'],
    ]);
    expect(value(wb, 'A1')).toEqual({ error: '#CIRC!' });
    expect(value(wb, 'B1')).toEqual({ error: '#CIRC!' });
    expect(value(wb, 'C1')).toEqual({ error: '#CIRC!' });
  });

  it('does not hang on a self reference', () => {
    expect(value(setCell(emptyWorkbook(), 0, 0, '=A1+1'), 'A1')).toEqual({ error: '#CIRC!' });
  });

  it('shows formulas raw and values computed', () => {
    const wb = set(emptyWorkbook(), [
      [0, 0, '1'],
      [1, 0, '=A1+1'],
    ]);
    expect(rawText(wb, 1, 0)).toBe('=A1+1');
    expect(rawText(wb, 5, 5)).toBe('');
    expect(displayText(2)).toBe('2');
    expect(displayText(1 / 3)).toBe('0.3333333333');
    expect(displayText({ error: '#REF!' })).toBe('#REF!');
    expect(displayText(undefined)).toBe('');
  });

  it('sorts the data block by a column', () => {
    const wb = workbookFromSheetData(sheet([30, 10, 20]));
    const asc = sortDataBlock(wb, 5, 'asc');
    expect([2, 3, 4].map((r) => asc.cells.get(`F${r}`))).toEqual([10, 20, 30]);
    expect(asc.cells.get('D2')).toBe('P1');
    const desc = sortDataBlock(wb, 5, 'desc');
    expect([2, 3, 4].map((r) => desc.cells.get(`F${r}`))).toEqual([30, 20, 10]);
  });

  it('sort keeps the header and rows below the data', () => {
    const wb = setCell(workbookFromSheetData(sheet([30, 10, 20])), 5, 5, '=SUM(F2:F4)');
    const sorted = sortDataBlock(wb, 5, 'asc');
    expect(sorted.cells.get('F1')).toBe('Sales Amount');
    expect(sorted.cells.get('F6')).toBe('=SUM(F2:F4)');
    expect(computeValues(sorted).get('F6')).toBe(60);
  });

  it('sorts numbers before text and blanks last', () => {
    let wb = workbookFromSheetData(sheet([0, 0, 0, 0]));
    wb = set(wb, [
      [5, 1, 'b'],
      [5, 2, '2'],
      [5, 3, ''],
      [5, 4, '1'],
    ]);
    const sorted = sortDataBlock(wb, 5, 'asc');
    expect([2, 3, 4, 5].map((r) => sorted.cells.get(`F${r}`))).toEqual([1, 2, 'b', undefined]);
  });

  it('suggests AutoSum over the numbers above', () => {
    const wb = workbookFromSheetData(sheet(Array.from({ length: 480 }, (_, i) => i)));
    const values = computeValues(wb);
    expect(autoSumFormula(wb, values, 5, 481)).toBe('=SUM(F2:F481)');
    expect(autoSumFormula(wb, values, 5, 1)).toBeUndefined();
  });

  it('sort keeps formulas in the block pointing at their own row', () => {
    let wb = workbookFromSheetData(sheet([0, 0]));
    wb = set(wb, [
      [0, 1, '3'],
      [6, 1, '=A2*2'],
      [0, 2, '1'],
      [6, 2, '=A3*2'],
    ]);
    const sorted = sortDataBlock(wb, 0, 'asc');
    expect(sorted.cells.get('G2')).toBe('=A2*2');
    expect(sorted.cells.get('G3')).toBe('=A3*2');
    expect(computeValues(sorted).get('G2')).toBe(2);
    expect(computeValues(sorted).get('G3')).toBe(6);
  });

  it('sorts a formula column by its values', () => {
    let wb = workbookFromSheetData(sheet([0, 0, 0]));
    wb = set(wb, [
      [6, 1, '=5'],
      [6, 2, '=20'],
      [6, 3, '=10'],
    ]);
    const sorted = sortDataBlock(wb, 6, 'desc');
    expect([2, 3, 4].map((r) => computeValues(sorted).get(`G${r}`))).toEqual([20, 10, 5]);
  });
});

describe('clearRange', () => {
  it('clears only the range', () => {
    let wb = emptyWorkbook();
    for (let col = 0; col < 3; col++) for (let row = 0; row < 3; row++) wb = setCell(wb, col, row, `${col}${row}`);
    const cleared = clearRange(wb, { left: 1, top: 0, right: 2, bottom: 1 });
    expect([...cleared.cells.keys()].sort()).toEqual(['A1', 'A2', 'A3', 'B3', 'C3']);
  });
});
