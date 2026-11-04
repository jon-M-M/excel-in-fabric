// Rewriting the cell references inside a formula: moving them when a formula is copied or sorted.

import { COLUMN_COUNT } from './address';
import { rangeBetween, type CellRange } from './selection';

// 0-based column and row; the $ anchors as written.
export interface Reference {
  col: number;
  row: number;
  colAbs: boolean;
  rowAbs: boolean;
}

const REF = String.raw`(\$?)([A-Za-z])(\$?)(\d+)`;
// A reference or a range of two, not followed by more name characters or a call's "(".
const REFERENCE = new RegExp(`${REF}(?::${REF})?(?![\\w(])`, 'g');

function read(colAbs: string, letter: string, rowAbs: string, row: string): Reference {
  return { col: letter.toUpperCase().charCodeAt(0) - 65, row: Number(row) - 1, colAbs: !!colAbs, rowAbs: !!rowAbs };
}

function write(ref: Reference, lowercase: boolean): string {
  const letter = String.fromCharCode(65 + ref.col);
  return `${ref.colAbs ? '$' : ''}${lowercase ? letter.toLowerCase() : letter}${ref.rowAbs ? '$' : ''}${ref.row + 1}`;
}

// Maps every reference outside quoted text; null means it no longer points at the sheet, which Excel shows as
// #REF! (for a range, if either end is gone).
export function mapReferences(formula: string, map: (ref: Reference) => Reference | null): string {
  return formula
    .split('"')
    .map((part, i) =>
      i % 2 === 1
        ? part
        : part.replace(REFERENCE, (_match, ...groups: (string | undefined)[]) => {
            const [c1, l1, r1, n1, c2, l2, r2, n2] = groups as string[];
            const from = map(read(c1, l1, r1, n1));
            if (l2 === undefined) return from ? write(from, l1 === l1.toLowerCase()) : '#REF!';
            const to = map(read(c2, l2, r2, n2));
            if (!from || !to) return '#REF!';
            return `${write(from, l1 === l1.toLowerCase())}:${write(to, l2 === l2.toLowerCase())}`;
          })
    )
    .join('"');
}

// Moves the relative parts of every reference, as when a formula is copied rows down and columns across.
export function shiftReferences(formula: string, rows: number, cols: number): string {
  return mapReferences(formula, (ref) => {
    const moved = {
      ...ref,
      col: ref.colAbs ? ref.col : ref.col + cols,
      row: ref.rowAbs ? ref.row : ref.row + rows,
    };
    return moved.row < 0 || moved.col < 0 || moved.col >= COLUMN_COUNT ? null : moved;
  });
}

// Where each reference or range sits in a formula (outside quoted text) and which cells it covers; references
// that don't point at the sheet are left out.
export function findReferences(formula: string): { start: number; end: number; range: CellRange }[] {
  const found: { start: number; end: number; range: CellRange }[] = [];
  let offset = 0;
  formula.split('"').forEach((part, i) => {
    if (i % 2 === 0) {
      for (const match of part.matchAll(REFERENCE)) {
        const [text, c1, l1, r1, n1, c2, l2, r2, n2] = match as unknown as string[];
        const from = read(c1, l1, r1, n1);
        const to = l2 === undefined ? from : read(c2, l2, r2, n2);
        if (from.row < 0 || to.row < 0) continue;
        const start = offset + (match.index ?? 0);
        found.push({ start, end: start + text.length, range: rangeBetween(from, to) });
      }
    }
    offset += part.length + 1;
  });
  return found;
}

// A colour number per reference, in order of first appearance; the same cells always get the same number.
export function referenceColors(refs: { range: CellRange }[]): number[] {
  const seen: string[] = [];
  return refs.map(({ range }) => {
    const key = `${range.left},${range.top},${range.right},${range.bottom}`;
    if (!seen.includes(key)) seen.push(key);
    return seen.indexOf(key);
  });
}
