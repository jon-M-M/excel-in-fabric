// Excel's point mode: while typing a formula, clicking a cell types its address.

import { toAddress } from './address';
import { isFormula } from './formula';
import type { Cursor } from './navigation';

// The reference the current point action typed: its place in the text and the cell it started from.
export interface PointRef {
  start: number;
  end: number;
  anchor: Cursor;
}

// Characters after which a reference can follow.
const OPENS_A_REFERENCE = new Set(['=', '+', '-', '*', '/', '(', ',']);

export function rangeText(a: Cursor, b: Cursor): string {
  const topLeft = toAddress(Math.min(a.col, b.col), Math.min(a.row, b.row));
  const bottomRight = toAddress(Math.max(a.col, b.col), Math.max(a.row, b.row));
  return topLeft === bottomRight ? topLeft : `${topLeft}:${bottomRight}`;
}

// Whether a click on a cell should type its address rather than finish the edit. With text selected, caret is
// the selection's start (the selection is what gets replaced).
export function canPoint(text: string, caret: number, point?: PointRef, selectionEnd = caret): boolean {
  if (!isFormula(text)) return false;
  if (point && caret === point.end && selectionEnd === caret) return true;
  const before = text.slice(0, caret).trimEnd();
  return OPENS_A_REFERENCE.has(before.slice(-1));
}

// Types a reference at the caret (over any selected text), or over the one just pointed at when the caret is
// still right after it.
export function insertReference(
  text: string,
  caret: number,
  reference: string,
  point?: PointRef,
  selectionEnd = caret
): { text: string; caret: number; span: { start: number; end: number } } {
  const replacingPoint = point && caret === point.end && selectionEnd === caret;
  const start = replacingPoint ? point.start : caret;
  const end = replacingPoint ? point.end : selectionEnd;
  const next = text.slice(0, start) + reference + text.slice(end);
  return { text: next, caret: start + reference.length, span: { start, end: start + reference.length } };
}
