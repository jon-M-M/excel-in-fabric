// Cell addresses. Columns and rows are 0-based internally; addresses are Excel-style (A1).

export const COLUMN_COUNT = 26;

export function columnLetter(col: number): string {
  return String.fromCharCode(65 + col);
}

export function toAddress(col: number, row: number): string {
  return `${columnLetter(col)}${row + 1}`;
}

export function parseAddress(text: string): { col: number; row: number } | undefined {
  const match = /^\$?([A-Za-z])\$?([1-9]\d*)$/.exec(text);
  if (!match) return undefined;
  return { col: match[1].toUpperCase().charCodeAt(0) - 65, row: Number(match[2]) - 1 };
}
