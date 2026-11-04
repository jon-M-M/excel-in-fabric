// Sheet state: the workbook, its computed values, the selection (active cell and far corner) and any open edit.

import { useMemo, useReducer } from 'react';

import { COLUMN_COUNT } from '@/sheet/address';
import type { CellValue } from '@/sheet/formula';
import { jump, lastUsedCell, move, type ArrowKey, type Cursor, type MoveKey } from '@/sheet/navigation';
import { fillRange } from '@/sheet/fill';
import { insertReference, rangeText, type PointRef } from '@/sheet/point-mode';
import { rangeBetween, type CellRange } from '@/sheet/selection';
import { toAddress } from '@/sheet/address';
import {
  autoSumFormula,
  clearRange,
  computeValues,
  setCell,
  sortDataBlock,
  type Workbook,
} from '@/sheet/workbook';

import { clampColumnWidth, type ColumnWidths } from './grid-geometry';

export interface SheetState {
  workbook: Workbook;
  values: ReadonlyMap<string, CellValue>;
  // The active cell (name box, formula bar, editing).
  cursor: Cursor;
  // The selection's far corner; equals cursor when one cell is selected.
  focus: Cursor;
  // caret: where to put the caret after a point action; point: the reference that action typed.
  editing: { text: string; origin: 'cell' | 'formula-bar'; caret?: number; point?: PointRef } | null;
  columnWidths: ColumnWidths;
}

type Action =
  | { type: 'select'; cursor: Cursor }
  | { type: 'extendTo'; cell: Cursor }
  | { type: 'startEdit'; text: string; origin: 'cell' | 'formula-bar' }
  | { type: 'changeEdit'; text: string }
  | { type: 'commitEdit'; then?: MoveKey; shift?: boolean }
  | { type: 'cancelEdit' }
  | { type: 'clearSelection' }
  | { type: 'move'; key: MoveKey; shift: boolean }
  | { type: 'jump'; key: ArrowKey; shift: boolean }
  | { type: 'jumpTo'; target: 'home' | 'end'; shift: boolean }
  | { type: 'sort'; direction: 'asc' | 'desc' }
  | { type: 'autoSum' }
  | { type: 'resizeColumn'; col: number; width: number }
  | { type: 'fill'; extent: CellRange }
  | { type: 'pointAt'; cell: Cursor; caret: number; extend: boolean; selectionEnd?: number }
  | { type: 'pointTo'; cell: Cursor }
  | { type: 'load'; workbook: Workbook };

const START: Cursor = { col: 0, row: 0 };

function withWorkbook(state: SheetState, workbook: Workbook): SheetState {
  return { ...state, workbook, values: computeValues(workbook) };
}

function commit(state: SheetState): SheetState {
  if (!state.editing) return state;
  const { col, row } = state.cursor;
  return { ...withWorkbook(state, setCell(state.workbook, col, row, state.editing.text)), editing: null };
}

export function selectionRange(state: SheetState): CellRange {
  return rangeBetween(state.cursor, state.focus);
}

const ARROWS = new Set<MoveKey>(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function moved(state: SheetState, key: MoveKey, shift: boolean): SheetState {
  const bounds = { cols: COLUMN_COUNT, rows: state.workbook.rowCount };
  if (shift && ARROWS.has(key)) return { ...state, focus: move(state.focus, key, false, bounds) };
  const cursor = move(state.cursor, key, shift, bounds);
  return { ...state, cursor, focus: cursor };
}

// Ctrl+arrow, Ctrl+Home, Ctrl+End: with Shift the far corner moves and the active cell stays.
function jumped(state: SheetState, target: (from: Cursor) => Cursor, shift: boolean): SheetState {
  if (shift) return { ...state, focus: target(state.focus) };
  const cursor = target(state.cursor);
  return { ...state, cursor, focus: cursor };
}

function reducer(state: SheetState, action: Action): SheetState {
  switch (action.type) {
    case 'select':
      return { ...commit(state), cursor: action.cursor, focus: action.cursor };
    case 'extendTo':
      return { ...commit(state), focus: action.cell };
    case 'startEdit':
      return { ...state, editing: { text: action.text, origin: action.origin } };
    case 'changeEdit':
      // Typing takes over from any point action: no caret to restore, no reference to replace.
      return state.editing ? { ...state, editing: { text: action.text, origin: state.editing.origin } } : state;
    case 'pointAt': {
      if (!state.editing) return state;
      const { text, point } = state.editing;
      const extend = action.extend && point && action.caret === point.end;
      const anchor = extend ? point.anchor : action.cell;
      const typed = insertReference(text, action.caret, rangeText(anchor, action.cell), point, action.selectionEnd);
      return {
        ...state,
        editing: { ...state.editing, text: typed.text, caret: typed.caret, point: { ...typed.span, anchor } },
      };
    }
    case 'pointTo': {
      const point = state.editing?.point;
      if (!state.editing || !point) return state;
      const typed = insertReference(state.editing.text, point.end, rangeText(point.anchor, action.cell), point);
      return {
        ...state,
        editing: { ...state.editing, text: typed.text, caret: typed.caret, point: { ...typed.span, anchor: point.anchor } },
      };
    }
    case 'commitEdit': {
      const committed = commit(state);
      return action.then ? moved(committed, action.then, action.shift ?? false) : committed;
    }
    case 'cancelEdit':
      return { ...state, editing: null };
    case 'clearSelection':
      return withWorkbook(state, clearRange(state.workbook, selectionRange(state)));
    case 'move':
      return moved(state, action.key, action.shift);
    case 'jump': {
      const { cells, rowCount } = state.workbook;
      const filled = (col: number, row: number) => cells.has(toAddress(col, row));
      const bounds = { cols: COLUMN_COUNT, rows: rowCount };
      return jumped(state, (from) => jump(from, action.key, filled, bounds), action.shift);
    }
    case 'jumpTo':
      return jumped(state, () => (action.target === 'home' ? START : lastUsedCell(state.workbook.cells.keys())), action.shift);
    case 'sort': {
      const base = commit(state);
      return withWorkbook(base, sortDataBlock(base.workbook, base.cursor.col, action.direction));
    }
    case 'autoSum': {
      const base = commit(state);
      const { col, row } = base.cursor;
      const formula = autoSumFormula(base.workbook, base.values, col, row);
      return formula ? withWorkbook(base, setCell(base.workbook, col, row, formula)) : base;
    }
    case 'fill': {
      const base = commit(state);
      const { extent } = action;
      const source = selectionRange(base);
      const filled = withWorkbook(base, fillRange(base.workbook, source, extent));
      // The selection becomes the source plus the filled cells. A selection is two corners, so an active cell
      // left inside it moves to the source edge the fill grew from (as close to staying put as the model allows).
      const edge = (at: number, low: number, high: number, sourceLow: number) =>
        at === low || at === high ? at : low === sourceLow ? low : high;
      const cursor = {
        col: edge(base.cursor.col, extent.left, extent.right, source.left),
        row: edge(base.cursor.row, extent.top, extent.bottom, source.top),
      };
      const focus = {
        col: cursor.col === extent.left ? extent.right : extent.left,
        row: cursor.row === extent.top ? extent.bottom : extent.top,
      };
      return { ...filled, cursor, focus };
    }
    case 'resizeColumn':
      return { ...state, columnWidths: new Map(state.columnWidths).set(action.col, clampColumnWidth(action.width)) };
    case 'load':
      return {
        ...withWorkbook(state, action.workbook),
        cursor: START,
        focus: START,
        editing: null,
        columnWidths: new Map(),
      };
  }
}

export function useSheet(initial: Workbook) {
  const [state, dispatch] = useReducer(reducer, initial, (workbook) => ({
    workbook,
    values: computeValues(workbook),
    cursor: START,
    focus: START,
    editing: null,
    columnWidths: new Map(),
  }));

  const actions = useMemo(
    () => ({
      select: (cursor: Cursor) => dispatch({ type: 'select', cursor }),
      extendTo: (cell: Cursor) => dispatch({ type: 'extendTo', cell }),
      startEdit: (text: string, origin: 'cell' | 'formula-bar' = 'cell') =>
        dispatch({ type: 'startEdit', text, origin }),
      changeEdit: (text: string) => dispatch({ type: 'changeEdit', text }),
      commitEdit: (then?: MoveKey, shift?: boolean) => dispatch({ type: 'commitEdit', then, shift }),
      cancelEdit: () => dispatch({ type: 'cancelEdit' }),
      clearSelection: () => dispatch({ type: 'clearSelection' }),
      moveCursor: (key: MoveKey, shift: boolean) => dispatch({ type: 'move', key, shift }),
      jump: (key: ArrowKey, shift: boolean) => dispatch({ type: 'jump', key, shift }),
      jumpHome: (shift: boolean) => dispatch({ type: 'jumpTo', target: 'home', shift }),
      jumpEnd: (shift: boolean) => dispatch({ type: 'jumpTo', target: 'end', shift }),
      sort: (direction: 'asc' | 'desc') => dispatch({ type: 'sort', direction }),
      autoSum: () => dispatch({ type: 'autoSum' }),
      resizeColumn: (col: number, width: number) => dispatch({ type: 'resizeColumn', col, width }),
      fill: (extent: CellRange) => dispatch({ type: 'fill', extent }),
      pointAt: (cell: Cursor, caret: number, extend: boolean, selectionEnd?: number) =>
        dispatch({ type: 'pointAt', cell, caret, extend, selectionEnd }),
      pointTo: (cell: Cursor) => dispatch({ type: 'pointTo', cell }),
      load: (workbook: Workbook) => dispatch({ type: 'load', workbook }),
    }),
    []
  );

  return { state, ...actions };
}

export type Sheet = ReturnType<typeof useSheet>;
