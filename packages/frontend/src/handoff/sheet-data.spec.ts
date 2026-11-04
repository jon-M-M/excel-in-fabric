import { describe, expect, it } from 'vitest';

import { toSheetData } from './sheet-data';

const table = (rows: unknown[][]) => ({
  columns: [
    '[Year]',
    '[Month]',
    '[Region]',
    '[Product]',
    '[Quantity]',
    '[Sales Amount]',
    '[Month Number]',
  ].map((name) => ({ name })),
  rows,
});

describe('toSheetData', () => {
  it('maps columns to the sheet header and drops Month Number', () => {
    expect(toSheetData(table([[2026, 'Jan', 'North', 'Chain', 3, 90, 1]]))).toEqual({
      header: ['Year', 'Month', 'Region', 'Product', 'Quantity', 'Sales Amount'],
      rows: [[2026, 'Jan', 'North', 'Chain', 3, 90]],
      truncated: false,
    });
  });

  it('keeps blanks as null', () => {
    expect(
      toSheetData(table([[2026, 'Jan', 'North', 'Chain', null, undefined, 1]])).rows[0].slice(4)
    ).toEqual([null, null]);
  });

  it('caps rows at 5000 and says so', () => {
    const rows = Array.from({ length: 5001 }, () => [2026, 'Jan', 'North', 'Chain', 1, 1, 1]);
    const data = toSheetData(table(rows));
    expect(data.rows).toHaveLength(5000);
    expect(data.truncated).toBe(true);
  });

  it('throws on unexpected columns', () => {
    expect(() => toSheetData({ columns: [{ name: '[Foo]' }], rows: [[1]] })).toThrow(
      'Unexpected columns'
    );
  });

  it('treats a result with no rows and no columns as empty', () => {
    expect(toSheetData({ columns: [], rows: [] })).toEqual({
      header: ['Year', 'Month', 'Region', 'Product', 'Quantity', 'Sales Amount'],
      rows: [],
      truncated: false,
    });
  });
});
