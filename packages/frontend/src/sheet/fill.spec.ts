import { describe, expect, it } from 'vitest';

import { fillDownExtent, fillExtent, fillRange } from './fill';
import { rangeBetween } from './selection';
import { computeValues, emptyWorkbook, setCell, type Workbook } from './workbook';

// Cells as { A1: '…' }; addresses are A–Z with 1-based rows.
function sheet(cells: Record<string, string>): Workbook {
  return Object.entries(cells).reduce((wb, [address, text]) => {
    const col = address.charCodeAt(0) - 65;
    const row = Number(address.slice(1)) - 1;
    return setCell(wb, col, row, text);
  }, emptyWorkbook());
}

const at = (address: string) => ({ col: address.charCodeAt(0) - 65, row: Number(address.slice(1)) - 1 });
const range = (from: string, to = from) => rangeBetween(at(from), at(to));

describe('fillExtent', () => {
  const source = range('B2');

  it('extends towards the pointer along one axis', () => {
    expect(fillExtent(source, at('B5'))).toEqual(range('B2', 'B5'));
    expect(fillExtent(source, at('E2'))).toEqual(range('B2', 'E2'));
    expect(fillExtent(source, at('A2'))).toEqual(range('A2', 'B2'));
    expect(fillExtent(source, at('B1'))).toEqual(range('B1', 'B2'));
  });

  it('is undefined inside the source', () => {
    expect(fillExtent(source, at('B2'))).toBeUndefined();
  });

  it('follows the longer distance, and goes down on a tie', () => {
    expect(fillExtent(source, at('D6'))).toEqual(range('B2', 'B6'));
    expect(fillExtent(source, at('D4'))).toEqual(range('B2', 'B4'));
  });
});

describe('fillRange', () => {
  it('copies a formula down', () => {
    const wb = fillRange(sheet({ B2: '=A2*2' }), range('B2'), range('B2', 'B4'));
    expect(wb.cells.get('B3')).toBe('=A3*2');
    expect(wb.cells.get('B4')).toBe('=A4*2');
  });

  it('copies values across', () => {
    const wb = fillRange(sheet({ A1: '7' }), range('A1'), range('A1', 'C1'));
    expect(wb.cells.get('B1')).toBe(7);
    expect(wb.cells.get('C1')).toBe(7);
  });

  it('repeats a block', () => {
    const wb = fillRange(sheet({ A1: '1', A2: '2' }), range('A1', 'A2'), range('A1', 'A5'));
    expect(['A3', 'A4', 'A5'].map((a) => wb.cells.get(a))).toEqual([1, 2, 1]);
  });

  it('fills up in line with the source', () => {
    const wb = fillRange(sheet({ A3: '3', A4: '4' }), range('A3', 'A4'), range('A1', 'A4'));
    expect(wb.cells.get('A1')).toBe(3);
    expect(wb.cells.get('A2')).toBe(4);
  });

  it('fill overwrites targets', () => {
    const wb = fillRange(sheet({ A1: '1', A2: 'x', A3: '=SUM(A1:A2)' }), range('A1'), range('A1', 'A3'));
    expect(wb.cells.get('A2')).toBe(1);
    expect(wb.cells.get('A3')).toBe(1);
  });

  it('an empty source cell clears the target', () => {
    const wb = fillRange(sheet({ A2: 'x' }), range('A1'), range('A1', 'A3'));
    expect(wb.cells.has('A2')).toBe(false);
  });

  it('fills up off the sheet as #REF!', () => {
    const wb = fillRange(sheet({ A2: '=A1' }), range('A2'), range('A1', 'A2'));
    expect(wb.cells.get('A1')).toBe('=#REF!');
    expect(computeValues(wb).get('A1')).toEqual({ error: '#REF!' });
  });

  it('keeps the sheet size', () => {
    const before = sheet({ A1: '1' });
    const wb = fillRange(before, range('A1'), range('A1', 'A3'));
    expect(wb.rowCount).toBe(before.rowCount);
    expect(wb.dataRows).toBe(before.dataRows);
  });
});

describe('fillDownExtent', () => {
  it('fills beside the data', () => {
    const wb = sheet({ A1: 'a', A2: 'b', A3: 'c', A4: 'd', A5: 'e' });
    expect(fillDownExtent(wb, range('B2'))).toEqual(range('B2', 'B5'));
    expect(fillDownExtent(wb, range('B2', 'C2'))).toEqual(range('B2', 'C5'));
  });

  it('stops at a gap', () => {
    expect(fillDownExtent(sheet({ A1: 'a', A2: 'b', A4: 'd' }), range('B2'))).toBeUndefined();
  });

  it('in column A does nothing', () => {
    expect(fillDownExtent(sheet({ A1: 'a', A2: 'b', A3: 'c' }), range('A2'))).toBeUndefined();
  });
});
