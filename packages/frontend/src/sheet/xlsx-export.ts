// Writes the sheet as a real .xlsx workbook, keeping formulas as formulas with their results.

import type ExcelJS from 'exceljs';

import { COLUMN_COUNT, columnLetter } from './address';
import { isError, isFormula, isValidFormula, type CellValue } from './formula';
import type { Raw } from './workbook';
import { displayText, type Workbook } from './workbook';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const MIN_WIDTH = 8;
const MAX_WIDTH = 40;
// Excel column widths are in characters of about 7px.
const PX_PER_CHARACTER = 7;

// Excel's own error codes; anything else (our #CIRC!) would make the file look corrupt.
const EXCEL_ERRORS = new Set(['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A']);
const NOT_A_NUMBER = { error: '#NUM!' as ExcelJS.CellErrorValue['error'] };

function formulaResult(value: CellValue | undefined): ExcelJS.CellFormulaValue['result'] {
  if (value === undefined || value === null) return undefined;
  if (isError(value)) {
    // Leave the result out and Excel recalculates (and shows its own circular-reference warning).
    return EXCEL_ERRORS.has(value.error) ? { error: value.error as ExcelJS.CellErrorValue['error'] } : undefined;
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return NOT_A_NUMBER;
  return value;
}

// What each cell is written as, so the file always opens cleanly in desktop Excel.
function cellValue(raw: Raw, value: CellValue | undefined): ExcelJS.CellValue {
  if (isFormula(raw)) {
    // A formula Excel can't read goes in as the text the user typed.
    if (!isValidFormula(raw)) return raw;
    const result = formulaResult(value);
    return result === undefined ? { formula: raw.slice(1) } : { formula: raw.slice(1), result };
  }
  if (typeof raw === 'number' && !Number.isFinite(raw)) return NOT_A_NUMBER;
  return raw;
}

const MAX_SHEET_NAME = 31;

// Excel refuses sheet names with : \ / ? * [ ], a leading or trailing apostrophe, or the name History.
export function safeSheetName(name: string): string {
  const cleaned = name.replace(/[*?:\\/[\]]/g, '_').replace(/^'+|'+$/g, '');
  const cut = cleaned.slice(0, MAX_SHEET_NAME).replace(/'+$/, '');
  return cut === '' || cut.toLowerCase() === 'history' ? 'Sheet1' : cut;
}

export async function workbookToXlsx(
  wb: Workbook,
  values: ReadonlyMap<string, CellValue>,
  sheetName: string,
  // Widths in px the user set in the sheet, by 0-based column; other columns fit their content.
  columnWidths: ReadonlyMap<number, number> = new Map()
): Promise<ArrayBuffer> {
  // Loaded on first export, so ExcelJS stays out of the app's start-up bundle.
  const { default: Excel } = await import('exceljs');
  const book = new Excel.Workbook();
  book.creator = 'Excel in Fabric';
  const sheet = book.addWorksheet(
    safeSheetName(sheetName),
    wb.dataRows > 0 ? { views: [{ state: 'frozen', ySplit: 1 }] } : undefined
  );

  const widths = Array.from({ length: COLUMN_COUNT }, () => MIN_WIDTH);
  for (const [address, raw] of wb.cells) {
    if (raw === null) continue;
    const cell = sheet.getCell(address);
    cell.value = cellValue(raw, values.get(address));
    const col = address.charCodeAt(0) - 65;
    widths[col] = Math.max(widths[col], displayText(values.get(address) ?? raw).length + 2);
  }

  widths.forEach((width, col) => {
    const px = columnWidths.get(col);
    sheet.getColumn(columnLetter(col)).width = px === undefined ? Math.min(width, MAX_WIDTH) : px / PX_PER_CHARACTER;
  });
  if (wb.dataRows > 0) sheet.getRow(1).font = { bold: true };

  return (await book.xlsx.writeBuffer()) as ArrayBuffer;
}
