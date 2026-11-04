import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { computeValues, setCell, workbookFromSheetData, type Workbook } from './workbook';
import { safeSheetName, workbookToXlsx } from './xlsx-export';

function sales(): Workbook {
  return workbookFromSheetData({
    header: ['Year', 'Month', 'Region', 'Product', 'Quantity', 'Sales Amount'],
    rows: [
      [2026, 'Jan', 'North', 'Chain', 3, 90],
      [2026, 'Jan', 'North', 'Mountain100', 2, 50],
    ],
    truncated: false,
  });
}

async function roundTrip(wb: Workbook, sheetName = 'Sales', widths?: ReadonlyMap<number, number>) {
  const buffer = await workbookToXlsx(wb, computeValues(wb), sheetName, widths);
  const read = new ExcelJS.Workbook();
  await read.xlsx.load(buffer);
  return read.worksheets[0];
}

describe('workbookToXlsx', () => {
  it('writes user-set widths in character units', async () => {
    const plain = await roundTrip(sales());
    const sized = await roundTrip(sales(), 'Sales', new Map([[1, 140]]));
    expect(sized.getColumn('B').width).toBe(20);
    expect(sized.getColumn('A').width).toBe(plain.getColumn('A').width);
  });

  it('writes values at their addresses', async () => {
    const sheet = await roundTrip(sales());
    expect(sheet.getCell('A1').value).toBe('Year');
    expect(sheet.getCell('A2').value).toBe(2026);
    expect(sheet.getCell('D2').value).toBe('Chain');
  });

  it('keeps formulas as formulas with their results', async () => {
    const sheet = await roundTrip(setCell(sales(), 5, 3, '=SUM(F2:F3)'));
    expect(sheet.getCell('F4').value).toEqual({ formula: 'SUM(F2:F3)', result: 140 });
  });

  it('exports a #REF! formula', async () => {
    const sheet = await roundTrip(setCell(sales(), 6, 1, '=#REF!+1'));
    expect(sheet.getCell('G2').value).toEqual({ formula: '#REF!+1', result: { error: '#REF!' } });
  });

  it('exports an error result', async () => {
    const sheet = await roundTrip(setCell(sales(), 6, 1, '=1/0'));
    expect(sheet.getCell('G2').value).toEqual({ formula: '1/0', result: { error: '#DIV/0!' } });
  });

  it('bolds and freezes the header row', async () => {
    const sheet = await roundTrip(sales());
    expect(sheet.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(sheet.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
  });

  it('names the sheet', async () => {
    const sheet = await roundTrip(sales(), 'Sales');
    expect(sheet.name).toBe('Sales');
  });

  it('sizes columns to their content', async () => {
    const sheet = await roundTrip(sales());
    const width = sheet.getColumn(4).width ?? 0;
    expect(width).toBeGreaterThanOrEqual('Mountain100'.length);
    expect(width).toBeLessThanOrEqual(40);
  });

  it.each(['=1+', '=SUM()', '='])('writes the broken formula %s as text', async (formula) => {
    const sheet = await roundTrip(setCell(sales(), 6, 1, formula));
    expect(sheet.getCell('G2').value).toBe(formula);
  });

  it('writes a circular reference without a result', async () => {
    const sheet = await roundTrip(setCell(sales(), 6, 1, '=G2+1'));
    expect(sheet.getCell('G2').value).toEqual({ formula: 'G2+1' });
  });

  it('writes a number that is not finite as #NUM!', async () => {
    const sheet = await roundTrip(setCell(sales(), 6, 1, '1e400'));
    expect(sheet.getCell('G2').value).toEqual({ error: '#NUM!' });
  });

  it.each([
    ['Q3 [draft]', 'Q3 _draft_'],
    ["'final'", 'final'],
    ['a/b:c*d?e\\f', 'a_b_c_d_e_f'],
    ['History', 'Sheet1'],
    ['', 'Sheet1'],
    ['x'.repeat(40), 'x'.repeat(31)],
  ])('cleans the sheet name %s', (name, expected) => {
    expect(safeSheetName(name)).toBe(expected);
  });

  it('exports with a sheet name Excel would refuse', async () => {
    const sheet = await roundTrip(sales(), 'Q3 [draft]');
    expect(sheet.name).toBe('Q3 _draft_');
  });
});
